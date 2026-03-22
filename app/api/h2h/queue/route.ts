import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { CURRENT_SEASON, H2H_QUEUE_TIMEOUT_MS, H2H_CARDS_PER_MATCH, H2H_MATCH_TTL } from '@/lib/h2h';

// ── Deal cards for a match ──

async function dealMatchCards(matchId: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('cards_generated')
    .select('*')
    .in('pool', ['freeplay', 'expert'])
    .limit(500);

  if (!data || data.length < H2H_CARDS_PER_MATCH) return [];

  // Fisher-Yates shuffle
  const arr = [...data];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const deck = arr.slice(0, H2H_CARDS_PER_MATCH);

  const cards = deck.map((row) => ({
    id: row.card_id,
    type: row.type,
    isPhishing: row.is_phishing,
    difficulty: row.difficulty ?? 'medium',
    from: row.from_address,
    subject: row.subject ?? undefined,
    body: row.body,
    clues: row.clues ?? [],
    explanation: row.explanation ?? '',
    highlights: row.highlights ?? [],
    technique: row.technique,
    authStatus: (row.auth_status ?? 'unverified') as 'verified' | 'unverified' | 'fail',
    attachmentName: row.attachment_name ?? undefined,
  }));

  await redis.set(`match-cards:${matchId}`, JSON.stringify(cards), { ex: H2H_MATCH_TTL });

  // Update match record with card IDs
  await supabase.from('h2h_matches').update({
    card_ids: cards.map((c) => c.id),
  }).eq('id', matchId);

  return cards.map((c) => c.id);
}

// ── Auth helper ──

interface AuthenticatedPlayer {
  id: string;
  display_name: string;
  research_graduated: boolean;
}

async function getAuthenticatedPlayer(): Promise<AuthenticatedPlayer | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data: player } = await admin
    .from('players')
    .select('id, display_name, research_graduated')
    .eq('auth_id', user.id)
    .single();

  return player ?? null;
}

// ── Queue entry shape stored in the sorted set ──

interface QueueEntry {
  playerId: string;
  displayName: string;
  rankPoints: number;
  joinedAt: number;
}

// ── POST — Join the matchmaking queue ──

export async function POST() {
  const player = await getAuthenticatedPlayer();
  if (!player) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!player.research_graduated) {
    return NextResponse.json({ error: 'Threat Terminal not unlocked' }, { status: 403 });
  }

  const playerId = player.id;

  // Prevent double-queue
  const alreadyQueued = await redis.get(`h2h:queue:player:${playerId}`);
  if (alreadyQueued) {
    return NextResponse.json({ error: 'Already in queue' }, { status: 409 });
  }

  // Get player's rank points for current season (default 0)
  const admin = getSupabaseAdminClient();
  const { data: stats } = await admin
    .from('h2h_player_stats')
    .select('rank_points')
    .eq('player_id', playerId)
    .eq('season', CURRENT_SEASON)
    .single();

  const rankPoints = stats?.rank_points ?? 0;
  const now = Date.now();

  const entry: QueueEntry = {
    playerId,
    displayName: player.display_name,
    rankPoints,
    joinedAt: now,
  };

  // Add to sorted set (score = timestamp for FIFO ordering)
  await redis.zadd('h2h:queue', { score: now, member: JSON.stringify(entry) });

  // Mark player as queued with 60s TTL
  await redis.set(`h2h:queue:player:${playerId}`, '1', { ex: 60 });

  return NextResponse.json({ queued: true });
}

// ── GET — Poll for a match ──

export async function GET() {
  const player = await getAuthenticatedPlayer();
  if (!player) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const playerId = player.id;

  // Check if already matched
  const existingMatchId = await redis.get<string>(`h2h:matched:${playerId}`);
  if (existingMatchId) {
    // Clean up queue keys
    await redis.del(`h2h:queue:player:${playerId}`);
    return NextResponse.json({ matched: true, matchId: existingMatchId });
  }

  // Get all queue entries (sorted by score/timestamp ascending)
  const rawEntries = await redis.zrange('h2h:queue', 0, -1);
  const entries: QueueEntry[] = rawEntries.map((raw) =>
    typeof raw === 'string' ? JSON.parse(raw) : raw as QueueEntry,
  );

  // Find self in queue
  const selfIdx = entries.findIndex((e) => e.playerId === playerId);
  if (selfIdx === -1) {
    // Player not in queue — nothing to do
    return NextResponse.json({ matched: false });
  }

  const selfEntry = entries[selfIdx];
  const now = Date.now();

  if (entries.length < 2) {
    // Not enough players — check for timeout → ghost match
    if (now - selfEntry.joinedAt >= H2H_QUEUE_TIMEOUT_MS) {
      const admin = getSupabaseAdminClient();
      const { data: match, error } = await admin
        .from('h2h_matches')
        .insert({
          season: CURRENT_SEASON,
          player1_id: playerId,
          player2_id: null,
          card_ids: [],
          status: 'active',
          is_ghost_match: true,
          is_rated: false,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error || !match) {
        return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
      }

      // Deal cards for the ghost match
      await dealMatchCards(match.id);

      // Clean up queue
      await redis.zrem('h2h:queue', JSON.stringify(selfEntry));
      await redis.del(`h2h:queue:player:${playerId}`);

      return NextResponse.json({ matched: true, matchId: match.id, isGhost: true });
    }

    return NextResponse.json({ matched: false });
  }

  // >= 2 entries — find first opponent (any entry that is not self)
  const opponentEntry = entries.find((e) => e.playerId !== playerId);
  if (!opponentEntry) {
    return NextResponse.json({ matched: false });
  }

  // Deterministic lock key: sorted player IDs to prevent race conditions
  const sortedIds = [playerId, opponentEntry.playerId].sort();
  const lockKey = `h2h:matching:${sortedIds[0]}:${sortedIds[1]}`;

  // Try to acquire lock (SET NX with 10s TTL)
  const acquired = await redis.set(lockKey, '1', { ex: 10, nx: true });
  if (!acquired) {
    // Another instance is already creating this match
    return NextResponse.json({ matched: false });
  }

  // Create the match
  const admin = getSupabaseAdminClient();
  const { data: match, error } = await admin
    .from('h2h_matches')
    .insert({
      season: CURRENT_SEASON,
      player1_id: sortedIds[0],
      player2_id: sortedIds[1],
      card_ids: [],
      status: 'active',
      is_ghost_match: false,
      is_rated: true,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !match) {
    // Release lock on failure so others can retry
    await redis.del(lockKey);
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }

  const matchId = match.id;

  // Deal cards for the match
  await dealMatchCards(matchId);

  // Set matched keys for both players (60s TTL so the other player sees it on next poll)
  await redis.set(`h2h:matched:${sortedIds[0]}`, matchId, { ex: 60 });
  await redis.set(`h2h:matched:${sortedIds[1]}`, matchId, { ex: 60 });

  // Remove both from queue
  await redis.zrem('h2h:queue', JSON.stringify(selfEntry));
  await redis.zrem('h2h:queue', JSON.stringify(opponentEntry));
  await redis.del(`h2h:queue:player:${sortedIds[0]}`);
  await redis.del(`h2h:queue:player:${sortedIds[1]}`);

  return NextResponse.json({ matched: true, matchId });
}

// ── DELETE — Leave the queue ──

export async function DELETE() {
  const player = await getAuthenticatedPlayer();
  if (!player) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const playerId = player.id;

  // Find and remove the player's entry from the sorted set
  const rawEntries = await redis.zrange('h2h:queue', 0, -1);
  for (const raw of rawEntries) {
    const entry: QueueEntry = typeof raw === 'string' ? JSON.parse(raw) : raw as QueueEntry;
    if (entry.playerId === playerId) {
      await redis.zrem('h2h:queue', typeof raw === 'string' ? raw : JSON.stringify(raw));
      break;
    }
  }

  // Remove the player-queue marker
  await redis.del(`h2h:queue:player:${playerId}`);

  return NextResponse.json({ ok: true });
}
