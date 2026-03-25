import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { CURRENT_SEASON, H2H_QUEUE_TIMEOUT_MS, H2H_CARDS_PER_MATCH, H2H_MATCH_TTL, getRankFromPoints, getRankIndex } from '@/lib/h2h';
import { THEMES } from '@/lib/themes';

// ── Deal cards for a match ──

async function dealMatchCards(matchId: string, playerIds: string[]): Promise<string[]> {
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

  // Set server-side render timestamp for card 0 for all players (for timing verification)
  const now = Date.now();
  for (const pid of playerIds) {
    await redis.set(`match-render:${matchId}:${pid}:0`, now, { ex: H2H_MATCH_TTL });
  }

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
  featured_badge: string | null;
  theme_id: string | null;
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
    .select('id, display_name, research_graduated, featured_badge, theme_id')
    .eq('auth_id', user.id)
    .single();

  return player ?? null;
}

// ── Queue entry stored in a separate Redis key per player ──

interface QueueEntry {
  playerId: string;
  displayName: string;
  rankPoints: number;
  featuredBadge: string | null;
  themeColor: string;
  joinedAt: number;
}

// Queue uses sorted set with player ID as member (score = join timestamp).
// Entry data stored separately at h2h:queue:entry:{playerId}.
// This avoids Upstash JSON serialization issues with sorted set members.

const QUEUE_KEY = 'h2h:queue:v2';
const QUEUE_ENTRY_PREFIX = 'h2h:queue:entry:';
const QUEUE_MARKER_PREFIX = 'h2h:queue:player:';
const STALE_THRESHOLD_MS = 45_000;

async function getQueueEntries(): Promise<QueueEntry[]> {
  // Get all player IDs from sorted set with scores (joinedAt timestamps)
  const members = await redis.zrange(QUEUE_KEY, 0, -1, { withScores: true }) as (string | number)[];

  // Parse pairs: [member, score, member, score, ...]
  const entries: QueueEntry[] = [];
  for (let i = 0; i < members.length; i += 2) {
    const playerId = String(members[i]);
    const joinedAt = Number(members[i + 1]);
    const data = await redis.get<QueueEntry>(`${QUEUE_ENTRY_PREFIX}${playerId}`);
    if (data) {
      entries.push({ ...data, playerId, joinedAt });
    }
  }
  return entries;
}

async function removeFromQueue(playerId: string) {
  await redis.zrem(QUEUE_KEY, playerId);
  await redis.del(`${QUEUE_ENTRY_PREFIX}${playerId}`);
  await redis.del(`${QUEUE_MARKER_PREFIX}${playerId}`);
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

  // Clean up stale match key and any previous queue entry (handles browser crash/reconnect)
  await redis.del(`h2h:matched:${playerId}`);
  await removeFromQueue(playerId);

  // Check if player is already in an active match
  const admin0 = getSupabaseAdminClient();
  const { data: activeMatch } = await admin0
    .from('h2h_matches')
    .select('id')
    .eq('status', 'active')
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .limit(1)
    .maybeSingle();

  if (activeMatch) {
    return NextResponse.json({ error: 'Already in an active match' }, { status: 409 });
  }

  // Prevent double-queue
  const alreadyQueued = await redis.get(`${QUEUE_MARKER_PREFIX}${playerId}`);
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

  const themeColor = THEMES.find(t => t.id === (player.theme_id ?? 'phosphor'))?.colors.primary ?? '#00ff41';

  const entry: QueueEntry = {
    playerId,
    displayName: player.display_name,
    rankPoints,
    featuredBadge: player.featured_badge ?? null,
    themeColor,
    joinedAt: now,
  };

  // Store entry data separately, add player ID to sorted set
  await redis.set(`${QUEUE_ENTRY_PREFIX}${playerId}`, JSON.stringify(entry), { ex: 120 });
  await redis.zadd(QUEUE_KEY, { score: now, member: playerId });

  // Mark player as queued with 60s TTL
  await redis.set(`${QUEUE_MARKER_PREFIX}${playerId}`, '1', { ex: 60 });

  return NextResponse.json({ queued: true });
}

// ── GET — Poll for a match ──

export async function GET() {
  const player = await getAuthenticatedPlayer();
  if (!player) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const playerId = player.id;

  // Refresh queue marker TTL on each poll (proves player is still online)
  await redis.expire(`${QUEUE_MARKER_PREFIX}${playerId}`, 15);

  // Check if already matched
  const existingMatchId = await redis.get<string>(`h2h:matched:${playerId}`);
  if (existingMatchId) {
    // Clean up queue keys
    await removeFromQueue(playerId);
    return NextResponse.json({ matched: true, matchId: existingMatchId });
  }

  // Get all queue entries
  const allEntries = await getQueueEntries();
  const now = Date.now();

  // Clean up stale entries — players who left without cancelling
  for (const e of allEntries) {
    if (now - e.joinedAt > STALE_THRESHOLD_MS && e.playerId !== playerId) {
      await removeFromQueue(e.playerId);
    }
  }

  // Re-read after cleanup
  const entries = await getQueueEntries();

  // Find self in queue
  const selfEntry = entries.find((e) => e.playerId === playerId);
  if (!selfEntry) {
    return NextResponse.json({ matched: false });
  }

  // Filter to non-stale entries
  const activeEntries = entries.filter((e) => now - e.joinedAt <= STALE_THRESHOLD_MS || e.playerId === playerId);

  if (activeEntries.length < 2) {
    // Not enough players — check for timeout → bot match
    const waitMs = now - selfEntry.joinedAt;
    if (waitMs >= H2H_QUEUE_TIMEOUT_MS) {
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
        console.error('[h2h:queue] Failed to create bot match:', error?.message);
        return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
      }

      // Deal cards for the bot match
      await dealMatchCards(match.id, [playerId]);

      // Clean up queue
      await removeFromQueue(playerId);

      return NextResponse.json({ matched: true, matchId: match.id, isBot: true });
    }

    return NextResponse.json({ matched: false });
  }

  // >= 2 entries — skill-based matchmaking
  // Prefer same-tier opponents, widen search over time
  const selfRank = getRankFromPoints(selfEntry.rankPoints);
  const selfRankIdx = getRankIndex(selfRank.tier);
  const waitSeconds = (now - selfEntry.joinedAt) / 1000;

  // Tier search radius widens: 0-5s = same tier, 5-15s = ±1, 15s+ = any
  const maxTierDiff = waitSeconds < 5 ? 0 : waitSeconds < 15 ? 1 : Infinity;

  // Find best opponent within tier range (closest rank first)
  // Only consider opponents whose queue marker key still exists (they're still polling)
  const candidateEntries = activeEntries.filter((e) => e.playerId !== playerId);
  const activeCandidates: QueueEntry[] = [];
  for (const c of candidateEntries) {
    const stillQueued = await redis.get(`${QUEUE_MARKER_PREFIX}${c.playerId}`);
    if (stillQueued) {
      activeCandidates.push(c);
    } else {
      // Stale entry — clean up
      await removeFromQueue(c.playerId);
    }
  }

  const candidates = activeCandidates
    .map((e) => {
      const oppRank = getRankFromPoints(e.rankPoints);
      const oppRankIdx = getRankIndex(oppRank.tier);
      return { entry: e, tierDiff: Math.abs(selfRankIdx - oppRankIdx) };
    })
    .filter((c) => c.tierDiff <= maxTierDiff)
    .sort((a, b) => a.tierDiff - b.tierDiff);

  const opponentEntry = candidates[0]?.entry;
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
  await dealMatchCards(matchId, sortedIds);

  // Set matched keys for both players (60s TTL so the other player sees it on next poll)
  await redis.set(`h2h:matched:${sortedIds[0]}`, matchId, { ex: 60 });
  await redis.set(`h2h:matched:${sortedIds[1]}`, matchId, { ex: 60 });

  // Remove both from queue
  await removeFromQueue(sortedIds[0]);
  await removeFromQueue(sortedIds[1]);

  return NextResponse.json({ matched: true, matchId });
}

// ── DELETE — Leave the queue ──

export async function DELETE() {
  const player = await getAuthenticatedPlayer();
  if (!player) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  await removeFromQueue(player.id);
  return NextResponse.json({ ok: true });
}
