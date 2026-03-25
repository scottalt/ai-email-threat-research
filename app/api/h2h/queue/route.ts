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

  const now = Date.now();
  for (const pid of playerIds) {
    await redis.set(`match-render:${matchId}:${pid}:0`, now, { ex: H2H_MATCH_TTL });
  }

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

// ── Queue entry shape ──

interface QueueEntry {
  playerId: string;
  displayName: string;
  rankPoints: number;
  featuredBadge: string | null;
  themeColor: string;
  joinedAt: number;
}

// Simplified queue: each waiting player stores their entry at a known key.
// A "registry" key lists all waiting player IDs.
// No sorted sets — just simple get/set/del.

const QUEUE_REGISTRY = 'h2h:queue:registry'; // Set of player IDs
const QUEUE_PREFIX = 'h2h:queue:data:';       // Per-player entry data
const QUEUE_TTL = 90;                          // Entry TTL in seconds

async function addToQueue(entry: QueueEntry) {
  await redis.set(`${QUEUE_PREFIX}${entry.playerId}`, JSON.stringify(entry), { ex: QUEUE_TTL });
  await redis.sadd(QUEUE_REGISTRY, entry.playerId);
}

async function removeFromQueue(playerId: string) {
  await redis.del(`${QUEUE_PREFIX}${playerId}`);
  await redis.srem(QUEUE_REGISTRY, playerId);
}

async function getQueueEntries(): Promise<QueueEntry[]> {
  const playerIds = await redis.smembers(QUEUE_REGISTRY);
  const entries: QueueEntry[] = [];

  for (const pid of playerIds) {
    const raw = await redis.get<string | QueueEntry>(`${QUEUE_PREFIX}${pid}`);
    if (!raw) {
      // Entry expired but ID still in registry — clean up
      await redis.srem(QUEUE_REGISTRY, pid);
      continue;
    }
    const entry: QueueEntry = typeof raw === 'string' ? JSON.parse(raw) : raw;
    entries.push(entry);
  }

  return entries;
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

  // Clean up stale state
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

  // Get player's rank points for current season
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

  await addToQueue(entry);
  console.log(`[h2h:queue:POST] added ${playerId.slice(0,8)} to queue, joinedAt=${now}`);

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
    await removeFromQueue(playerId);
    return NextResponse.json({ matched: true, matchId: existingMatchId });
  }

  // Get all queue entries
  const allEntries = await getQueueEntries();
  const now = Date.now();

  // Find self
  const selfEntry = allEntries.find((e) => e.playerId === playerId);
  if (!selfEntry) {
    console.log(`[h2h:queue:GET] player NOT in queue. entries: ${allEntries.length}, ids: [${allEntries.map(e => e.playerId.slice(0,8)).join(',')}], looking for: ${playerId.slice(0,8)}`);
    return NextResponse.json({ matched: false });
  }

  // Clean stale entries (older than 45s, not self)
  for (const e of allEntries) {
    if (now - e.joinedAt > 45_000 && e.playerId !== playerId) {
      await removeFromQueue(e.playerId);
    }
  }

  // Refresh self entry TTL (proves still online)
  await redis.expire(`${QUEUE_PREFIX}${playerId}`, QUEUE_TTL);

  // Filter to active entries
  const activeEntries = allEntries.filter(
    (e) => (now - e.joinedAt <= 45_000 || e.playerId === playerId)
  );

  if (activeEntries.length < 2) {
    // Solo in queue — check for bot timeout
    const waitMs = now - selfEntry.joinedAt;
    console.log(`[h2h:queue:GET] solo, waitMs=${waitMs}, threshold=${H2H_QUEUE_TIMEOUT_MS}, active=${activeEntries.length}`);
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

      await dealMatchCards(match.id, [playerId]);
      await removeFromQueue(playerId);

      return NextResponse.json({ matched: true, matchId: match.id, isBot: true });
    }

    return NextResponse.json({ matched: false });
  }

  // >= 2 entries — skill-based matchmaking
  const selfRank = getRankFromPoints(selfEntry.rankPoints);
  const selfRankIdx = getRankIndex(selfRank.tier);
  const waitSeconds = (now - selfEntry.joinedAt) / 1000;
  const maxTierDiff = waitSeconds < 5 ? 0 : waitSeconds < 15 ? 1 : Infinity;

  const candidates = activeEntries
    .filter((e) => e.playerId !== playerId)
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

  // Deterministic lock
  const sortedIds = [playerId, opponentEntry.playerId].sort();
  const lockKey = `h2h:matching:${sortedIds[0]}:${sortedIds[1]}`;
  const acquired = await redis.set(lockKey, '1', { ex: 10, nx: true });
  if (!acquired) {
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
    await redis.del(lockKey);
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }

  const matchId = match.id;
  await dealMatchCards(matchId, sortedIds);

  await redis.set(`h2h:matched:${sortedIds[0]}`, matchId, { ex: 60 });
  await redis.set(`h2h:matched:${sortedIds[1]}`, matchId, { ex: 60 });

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
