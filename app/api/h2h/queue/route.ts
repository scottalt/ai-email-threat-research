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
  const { data, error: cardErr } = await supabase
    .from('cards_generated')
    .select('*')
    .in('pool', ['freeplay', 'expert'])
    .limit(500);

  if (cardErr) {
    console.error(`[H2H] Card fetch failed:`, cardErr.message);
    return [];
  }
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

  const setResult = await redis.set(`match-cards:${matchId}`, JSON.stringify(cards), { ex: H2H_MATCH_TTL });
  if (!setResult) {
    console.error(`[H2H] Failed to store match cards in Redis for match ${matchId}`);
    return [];
  }

  const now = Date.now();
  for (const pid of playerIds) {
    await redis.set(`match-render:${matchId}:${pid}:0`, now, { ex: H2H_MATCH_TTL });
  }

  const { error: updateErr } = await supabase.from('h2h_matches').update({
    card_ids: cards.map((c) => c.id),
  }).eq('id', matchId);
  if (updateErr) {
    console.error(`[H2H] Failed to update card_ids in Supabase for match ${matchId}:`, updateErr.message);
  }

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
  // Pipeline for near-atomic add (single HTTP round-trip to Redis)
  const pipe = redis.pipeline();
  pipe.set(`${QUEUE_PREFIX}${entry.playerId}`, JSON.stringify(entry), { ex: QUEUE_TTL });
  pipe.sadd(QUEUE_REGISTRY, entry.playerId);
  await pipe.exec();
}

async function removeFromQueue(playerId: string) {
  await redis.del(`${QUEUE_PREFIX}${playerId}`);
  await redis.srem(QUEUE_REGISTRY, playerId);
}

async function getQueueEntries(): Promise<QueueEntry[]> {
  const playerIds = await redis.smembers(QUEUE_REGISTRY);
  if (playerIds.length === 0) return [];

  // Pipeline all GETs into a single Redis round-trip — O(1) instead of O(n)
  const pipe = redis.pipeline();
  for (const pid of playerIds) {
    pipe.get(`${QUEUE_PREFIX}${pid}`);
  }
  const results = await pipe.exec();

  const entries: QueueEntry[] = [];
  const staleIds: string[] = [];

  for (let i = 0; i < playerIds.length; i++) {
    const raw = results[i] as string | QueueEntry | null;
    if (!raw) {
      staleIds.push(playerIds[i]);
      continue;
    }
    let entry: QueueEntry;
    try {
      entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      console.error(`[H2H Queue] Corrupted queue data for player ${playerIds[i]}, removing`);
      staleIds.push(playerIds[i]);
      continue;
    }
    entries.push(entry);
  }

  // Clean up stale registry entries in a single pipeline
  if (staleIds.length > 0) {
    const cleanPipe = redis.pipeline();
    for (const pid of staleIds) {
      cleanPipe.srem(QUEUE_REGISTRY, pid);
    }
    await cleanPipe.exec();
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

  // Rate limit: max 5 queue joins per 30 seconds per player
  // Use atomic INCR + EXPIRE together to prevent orphaned keys without TTL
  const joinRlKey = `ratelimit:h2h-join:${playerId}`;
  const [joinCount] = await Promise.all([
    redis.incr(joinRlKey),
    redis.expire(joinRlKey, 30, 'NX'),
  ]);
  if (joinCount > 5) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Clean up stale state
  await redis.del(`h2h:matched:${playerId}`);
  await removeFromQueue(playerId);

  // Check for active matches — cancel stale ones, block if recent one exists
  const admin0 = getSupabaseAdminClient();
  const { data: activeMatch } = await admin0
    .from('h2h_matches')
    .select('id, started_at')
    .eq('status', 'active')
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .limit(1)
    .maybeSingle();

  if (activeMatch) {
    const matchAge = Date.now() - new Date(activeMatch.started_at).getTime();
    if (matchAge > 10 * 60 * 1000) {
      // Stale match — cancel it
      await admin0.from('h2h_matches')
        .update({ status: 'cancelled', ended_at: new Date().toISOString() })
        .eq('id', activeMatch.id);
    } else {
      return NextResponse.json({ error: 'Already in an active match' }, { status: 409 });
    }
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

  // Record join time for bot endpoint server-side wait enforcement
  await redis.set(`h2h:queue-joined:${playerId}`, now, { ex: 120 });

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
    // Player not in queue — entry may have expired
    return NextResponse.json({ matched: false });
  }

  // Clean stale entries — only ~20% of polls to reduce Redis ops
  if (Math.random() < 0.2) {
    for (const e of allEntries) {
      if (now - e.joinedAt > 45_000 && e.playerId !== playerId) {
        await removeFromQueue(e.playerId);
      }
    }
  }

  // Refresh self entry TTL (proves still online)
  await redis.expire(`${QUEUE_PREFIX}${playerId}`, QUEUE_TTL);

  // Filter to active entries
  const activeEntries = allEntries.filter(
    (e) => (now - e.joinedAt <= 45_000 || e.playerId === playerId)
  );

  if (activeEntries.length < 2) {
    // Solo in queue — bot match creation is handled client-side via POST /api/h2h/queue/bot
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

  // Per-player locks — acquired sequentially in sorted order to prevent deadlocks
  const sortedIds = [playerId, opponentEntry.playerId].sort();
  const lockA = `h2h:player-lock:${sortedIds[0]}`;
  const lockB = `h2h:player-lock:${sortedIds[1]}`;
  const acquiredA = await redis.set(lockA, '1', { ex: 30, nx: true });
  if (!acquiredA) return NextResponse.json({ matched: false });
  const acquiredB = await redis.set(lockB, '1', { ex: 30, nx: true });
  if (!acquiredB) {
    await redis.del(lockA);
    return NextResponse.json({ matched: false });
  }

  // Remove BOTH players from queue BEFORE creating match (prevents double-matching)
  await removeFromQueue(sortedIds[0]);
  await removeFromQueue(sortedIds[1]);

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
    // Match creation failed — re-add both players with fresh timestamps
    selfEntry.joinedAt = Date.now();
    opponentEntry.joinedAt = Date.now();
    await addToQueue(selfEntry);
    await addToQueue(opponentEntry);
    await redis.del(lockA);
    await redis.del(lockB);
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
  }

  const matchId = match.id;

  // Deal cards — wrapped in try-catch so throws also trigger full cleanup
  let dealtCardIds: string[];
  try {
    dealtCardIds = await dealMatchCards(matchId, sortedIds);
  } catch (dealErr) {
    console.error(`[H2H] dealMatchCards threw for match ${matchId}:`, dealErr);
    dealtCardIds = [];
  }

  if (dealtCardIds.length === 0) {
    // Card dealing failed — cancel the zombie match and re-queue players
    await admin.from('h2h_matches')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', matchId);
    selfEntry.joinedAt = Date.now();
    opponentEntry.joinedAt = Date.now();
    await addToQueue(selfEntry);
    await addToQueue(opponentEntry);
    await redis.del(lockA);
    await redis.del(lockB);
    console.error(`[H2H] dealMatchCards failed for match ${matchId} — cancelled`);
    return NextResponse.json({ error: 'Failed to deal cards' }, { status: 500 });
  }

  await redis.set(`h2h:matched:${sortedIds[0]}`, matchId, { ex: 300 });
  await redis.set(`h2h:matched:${sortedIds[1]}`, matchId, { ex: 300 });

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
