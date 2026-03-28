# Head-to-Head Competitive Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time 1v1 matchmaking mode where players race through 5 cards — wrong answer eliminates, fastest perfect run wins, with seasonal ranked tiers.

**Architecture:** Supabase Realtime Broadcast for in-match communication, Redis for matchmaking queue and card storage, 3 new DB tables (`h2h_matches`, `h2h_match_answers`, `h2h_player_stats`). New `h2h` game mode added to existing type system. All schema changes target dev DB only via `supabase db push --project-ref $SUPABASE_DEV_REF`.

**Tech Stack:** Next.js API routes, Supabase Realtime (bundled in supabase-js 2.98), Upstash Redis, existing card pool (`cards_generated` table).

**Important constraints:**
- All DB migrations target **dev DB only** (`SUPABASE_DEV_REF`)
- Nothing touches research mode, `cards_real`, or the `answers` table
- H2H requires `research_graduated = true` (same gate as expert mode)
- Preview/feature branch deployments only — no prod until tested

---

### Task 1: Database Schema — H2H Tables

**Files:**
- Create: `supabase/migrations/20260322200000_create-h2h-tables.sql`

This migration creates all three H2H tables. Run against dev DB only.

- [ ] **Step 1: Write the migration file**

```sql
-- Head-to-head competitive mode tables
-- Season 0 (beta)

-- Matches
CREATE TABLE h2h_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL DEFAULT 'season-0',
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  ghost_run_id UUID REFERENCES h2h_matches(id),
  card_ids TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'complete', 'cancelled')),
  winner_id UUID REFERENCES players(id),
  player1_time_ms INT,
  player2_time_ms INT,
  player1_cards_completed SMALLINT DEFAULT 0,
  player2_cards_completed SMALLINT DEFAULT 0,
  player1_rank_tier TEXT,
  player2_rank_tier TEXT,
  player1_points_delta INT,
  player2_points_delta INT,
  is_ghost_match BOOLEAN DEFAULT FALSE,
  is_rated BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_h2h_matches_player1 ON h2h_matches(player1_id);
CREATE INDEX idx_h2h_matches_player2 ON h2h_matches(player2_id);
CREATE INDEX idx_h2h_matches_season ON h2h_matches(season);
CREATE INDEX idx_h2h_matches_status ON h2h_matches(status);

-- Per-card answers within a match
CREATE TABLE h2h_match_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES h2h_matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  card_index SMALLINT NOT NULL,
  card_id TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  user_answer TEXT NOT NULL CHECK (user_answer IN ('phishing', 'legit')),
  time_from_render_ms INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, player_id, card_index)
);

CREATE INDEX idx_h2h_answers_match ON h2h_match_answers(match_id);
CREATE INDEX idx_h2h_answers_player ON h2h_match_answers(player_id);

-- Seasonal player stats
CREATE TABLE h2h_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  season TEXT NOT NULL DEFAULT 'season-0',
  rank_points INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  win_streak INT NOT NULL DEFAULT 0,
  best_win_streak INT NOT NULL DEFAULT 0,
  peak_rank_points INT NOT NULL DEFAULT 0,
  rated_matches_today SMALLINT NOT NULL DEFAULT 0,
  last_match_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season)
);

CREATE INDEX idx_h2h_stats_season_points ON h2h_player_stats(season, rank_points DESC);
CREATE INDEX idx_h2h_stats_player ON h2h_player_stats(player_id);

-- Enable RLS on all tables
ALTER TABLE h2h_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE h2h_match_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE h2h_player_stats ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Push migration to dev DB**

Run: `npx supabase db push --project-ref $SUPABASE_DEV_REF`
Expected: Migration applied successfully, 3 tables created.

- [ ] **Step 3: Verify tables exist in dev**

Run: `npx supabase db dump --project-ref $SUPABASE_DEV_REF | grep h2h`
Expected: All three tables and indexes listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260322200000_create-h2h-tables.sql
git commit -m "feat: add h2h_matches, h2h_match_answers, h2h_player_stats tables (dev only)"
```

---

### Task 2: H2H Shared Library — Types, Ranks, and Utilities

**Files:**
- Create: `lib/h2h.ts`
- Modify: `lib/types.ts` — add `'h2h'` to GameMode union

- [ ] **Step 1: Add h2h to GameMode type**

In `lib/types.ts`, update the GameMode union:
```typescript
export type GameMode = 'freeplay' | 'daily' | 'research' | 'preview' | 'expert' | 'h2h';
```

- [ ] **Step 2: Create lib/h2h.ts with rank system and utilities**

```typescript
// lib/h2h.ts — Head-to-head constants, rank system, and point calculations

export const H2H_CARDS_PER_MATCH = 5;
export const H2H_QUEUE_TIMEOUT_MS = 30_000;
export const H2H_MATCH_TTL = 60 * 30; // 30 min Redis TTL
export const H2H_DAILY_RATED_CAP = 20;
export const H2H_DAILY_HALF_RATE_AFTER = 10;
export const CURRENT_SEASON = 'season-0';

export interface H2HRank {
  tier: string;
  label: string;
  minPoints: number;
  color: string;
}

export const H2H_RANKS: H2HRank[] = [
  { tier: 'bronze',   label: 'BRONZE',   minPoints: 0,    color: '#003a0e' },
  { tier: 'silver',   label: 'SILVER',   minPoints: 100,  color: '#00aa28' },
  { tier: 'gold',     label: 'GOLD',     minPoints: 250,  color: '#ffaa00' },
  { tier: 'platinum', label: 'PLATINUM', minPoints: 450,  color: '#00aaff' },
  { tier: 'diamond',  label: 'DIAMOND',  minPoints: 700,  color: '#ff0080' },
  { tier: 'master',   label: 'MASTER',   minPoints: 1000, color: '#ff3333' },
  { tier: 'elite',    label: 'ELITE',    minPoints: 1400, color: '#ffd700' },
];

export function getRankFromPoints(points: number): H2HRank {
  for (let i = H2H_RANKS.length - 1; i >= 0; i--) {
    if (points >= H2H_RANKS[i].minPoints) return H2H_RANKS[i];
  }
  return H2H_RANKS[0];
}

export function getRankIndex(tier: string): number {
  return H2H_RANKS.findIndex((r) => r.tier === tier);
}

/**
 * Calculate ranked points delta based on tier difference.
 * Positive = points gained, negative = points lost.
 */
export function calculatePointsDelta(
  winnerTier: string,
  loserTier: string,
  isWinner: boolean,
  ratedMatchesToday: number,
): number {
  const winnerIdx = getRankIndex(winnerTier);
  const loserIdx = getRankIndex(loserTier);
  const tierDiff = loserIdx - winnerIdx; // positive = opponent higher ranked

  // Point tables indexed by tier difference
  const winPoints: Record<number, number> = {
    [-3]: 12, [-2]: 12, [-1]: 18, 0: 25, 1: 35, 2: 45, 3: 45,
  };
  const lossPoints: Record<number, number> = {
    [-3]: -30, [-2]: -30, [-1]: -25, 0: -18, 1: -12, 2: -8, 3: -8,
  };

  const clampedDiff = Math.max(-3, Math.min(3, tierDiff));
  let delta = isWinner
    ? (winPoints[clampedDiff] ?? 25)
    : (lossPoints[-clampedDiff] ?? -18);

  // Daily diminishing returns
  if (ratedMatchesToday >= H2H_DAILY_RATED_CAP) {
    delta = 0;
  } else if (ratedMatchesToday >= H2H_DAILY_HALF_RATE_AFTER) {
    delta = Math.round(delta / 2);
  }

  return delta;
}

export interface H2HPlayerStats {
  playerId: string;
  season: string;
  rankPoints: number;
  rank: H2HRank;
  wins: number;
  losses: number;
  winStreak: number;
  bestWinStreak: number;
  peakRankPoints: number;
  ratedMatchesToday: number;
}

export interface H2HMatch {
  id: string;
  season: string;
  player1Id: string;
  player2Id: string | null;
  cardIds: string[];
  status: 'waiting' | 'active' | 'complete' | 'cancelled';
  winnerId: string | null;
  isGhostMatch: boolean;
  isRated: boolean;
  startedAt: string | null;
  endedAt: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/h2h.ts lib/types.ts
git commit -m "feat: add h2h types, rank system, and point calculation utilities"
```

---

### Task 3: Card Dealing — H2H Match Deck

**Files:**
- Create: `app/api/h2h/cards/route.ts`
- Reference: `app/api/cards/freeplay/route.ts` and `app/api/cards/expert/route.ts` for patterns
- Reference: `lib/card-utils.ts` for `toSafeCard()`

This endpoint creates a shared 5-card deck for a match and stores it in Redis.

- [ ] **Step 1: Create the card dealing endpoint**

```typescript
// app/api/h2h/cards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { toSafeCard } from '@/lib/card-utils';
import { H2H_CARDS_PER_MATCH, H2H_MATCH_TTL } from '@/lib/h2h';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * POST /api/h2h/cards
 * Called by the server when a match is created.
 * Deals 5 cards from freeplay+expert pools and stores them in Redis.
 * Body: { matchId: string }
 * Returns: { cardIds: string[] }
 */
export async function POST(req: NextRequest) {
  const { matchId } = await req.json();
  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
  }

  // Check if cards already dealt for this match
  const existing = await redis.get<string>(`match-cards:${matchId}`);
  if (existing) {
    const cards = typeof existing === 'string' ? JSON.parse(existing) : existing;
    return NextResponse.json({ cardIds: cards.map((c: { id: string }) => c.id) });
  }

  const supabase = getSupabaseAdminClient();

  // Fetch from both freeplay and expert pools
  const { data, error } = await supabase
    .from('cards_generated')
    .select('*')
    .in('pool', ['freeplay', 'expert'])
    .limit(500);

  if (error || !data || data.length < H2H_CARDS_PER_MATCH) {
    return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 });
  }

  const deck = shuffle(data).slice(0, H2H_CARDS_PER_MATCH);

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
    replyTo: row.reply_to ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    sentAt: row.sent_at ?? undefined,
  }));

  // Store full cards in Redis for answer verification
  await redis.set(`match-cards:${matchId}`, JSON.stringify(cards), { ex: H2H_MATCH_TTL });

  return NextResponse.json({ cardIds: cards.map((c) => c.id) });
}

/**
 * GET /api/h2h/cards?matchId=xxx
 * Returns safe (stripped) cards for the match.
 */
export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get('matchId');
  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
  }

  const cardsJson = await redis.get<string>(`match-cards:${matchId}`);
  if (!cardsJson) {
    return NextResponse.json({ error: 'Match not found or expired' }, { status: 404 });
  }

  const cards = typeof cardsJson === 'string' ? JSON.parse(cardsJson) : cardsJson;
  return NextResponse.json(cards.map(toSafeCard));
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/h2h/cards/route.ts
git commit -m "feat: add h2h card dealing endpoint (freeplay+expert pool, 5 cards)"
```

---

### Task 4: Matchmaking Queue API

**Files:**
- Create: `app/api/h2h/queue/route.ts`

Handles joining, polling, and leaving the matchmaking queue. Uses Redis sorted set for the queue and creates matches when two players are available.

- [ ] **Step 1: Create the matchmaking queue endpoint**

```typescript
// app/api/h2h/queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { CURRENT_SEASON, H2H_QUEUE_TIMEOUT_MS, getRankFromPoints } from '@/lib/h2h';

async function getAuthenticatedPlayer() {
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

  return player;
}

/**
 * POST /api/h2h/queue — Join the matchmaking queue
 */
export async function POST() {
  const player = await getAuthenticatedPlayer();
  if (!player) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!player.research_graduated) {
    return NextResponse.json({ error: 'Complete research to unlock H2H' }, { status: 403 });
  }

  // Prevent double-queue
  const alreadyQueued = await redis.get(`h2h:queue:player:${player.id}`);
  if (alreadyQueued) {
    return NextResponse.json({ error: 'Already in queue' }, { status: 409 });
  }

  // Rate limit: 5 queue joins per minute
  const ip = 'unknown'; // Will be set from headers in production
  const rlKey = `ratelimit:h2h-queue:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 5) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Get player's rank for matchmaking preference
  const admin = getSupabaseAdminClient();
  const { data: stats } = await admin
    .from('h2h_player_stats')
    .select('rank_points')
    .eq('player_id', player.id)
    .eq('season', CURRENT_SEASON)
    .single();

  const rankPoints = stats?.rank_points ?? 0;

  // Add to queue (sorted set: score = timestamp, member = JSON with player info)
  const queueEntry = JSON.stringify({
    playerId: player.id,
    displayName: player.display_name,
    rankPoints,
    joinedAt: Date.now(),
  });

  await redis.zadd('h2h:queue', { score: Date.now(), member: queueEntry });
  await redis.set(`h2h:queue:player:${player.id}`, '1', { ex: 60 });

  return NextResponse.json({ queued: true });
}

/**
 * GET /api/h2h/queue — Poll for a match
 */
export async function GET() {
  const player = await getAuthenticatedPlayer();
  if (!player) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Check if player is still in queue
  const inQueue = await redis.get(`h2h:queue:player:${player.id}`);
  if (!inQueue) {
    return NextResponse.json({ matched: false, expired: true });
  }

  // Check if a match was already created for this player
  const matchId = await redis.get<string>(`h2h:matched:${player.id}`);
  if (matchId) {
    // Clean up
    await redis.del(`h2h:queue:player:${player.id}`);
    return NextResponse.json({ matched: true, matchId });
  }

  // Try to find an opponent from the queue
  const queueEntries = await redis.zrange('h2h:queue', 0, -1);
  if (queueEntries.length < 2) {
    // Check for ghost timeout
    const playerEntry = queueEntries.find((e) => {
      const parsed = JSON.parse(e as string);
      return parsed.playerId === player.id;
    });
    if (playerEntry) {
      const parsed = JSON.parse(playerEntry as string);
      if (Date.now() - parsed.joinedAt > H2H_QUEUE_TIMEOUT_MS) {
        // Ghost match — create match with no opponent
        const admin = getSupabaseAdminClient();
        const { data: match } = await admin.from('h2h_matches').insert({
          season: CURRENT_SEASON,
          player1_id: player.id,
          player2_id: null,
          card_ids: [],
          status: 'active',
          is_ghost_match: true,
          is_rated: false,
          started_at: new Date().toISOString(),
        }).select('id').single();

        if (match) {
          // Deal cards
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/api/h2h/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: match.id }),
          });

          await admin.from('h2h_matches').update({ card_ids: [] }).eq('id', match.id);

          // Clean up queue
          await redis.zrem('h2h:queue', playerEntry as string);
          await redis.del(`h2h:queue:player:${player.id}`);

          return NextResponse.json({ matched: true, matchId: match.id, isGhost: true });
        }
      }
    }
    return NextResponse.json({ matched: false });
  }

  // Two or more players in queue — try to match
  const entries = queueEntries.map((e) => JSON.parse(e as string));
  const self = entries.find((e) => e.playerId === player.id);
  const opponent = entries.find((e) => e.playerId !== player.id);

  if (!self || !opponent) {
    return NextResponse.json({ matched: false });
  }

  // Atomically check we haven't already matched (race condition guard)
  const lockKey = `h2h:matching:${[self.playerId, opponent.playerId].sort().join(':')}`;
  const locked = await redis.set(lockKey, '1', { ex: 10, nx: true });
  if (!locked) {
    return NextResponse.json({ matched: false });
  }

  // Create the match
  const admin = getSupabaseAdminClient();
  const { data: match } = await admin.from('h2h_matches').insert({
    season: CURRENT_SEASON,
    player1_id: self.playerId,
    player2_id: opponent.playerId,
    card_ids: [],
    status: 'active',
    is_ghost_match: false,
    is_rated: true,
    started_at: new Date().toISOString(),
  }).select('id').single();

  if (!match) {
    await redis.del(lockKey);
    return NextResponse.json({ matched: false });
  }

  // Deal cards for the match
  const cardsRes = await fetch(new URL('/api/h2h/cards', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId: match.id }),
  });
  const cardsData = await cardsRes.json();

  // Update match with card IDs
  await admin.from('h2h_matches').update({
    card_ids: cardsData.cardIds ?? [],
  }).eq('id', match.id);

  // Notify both players via Redis (they'll pick it up on next poll)
  await redis.set(`h2h:matched:${self.playerId}`, match.id, { ex: 60 });
  await redis.set(`h2h:matched:${opponent.playerId}`, match.id, { ex: 60 });

  // Clean up queue
  await redis.zrem('h2h:queue', ...queueEntries.filter((e) => {
    const p = JSON.parse(e as string);
    return p.playerId === self.playerId || p.playerId === opponent.playerId;
  }) as string[]);
  await redis.del(`h2h:queue:player:${self.playerId}`);
  await redis.del(`h2h:queue:player:${opponent.playerId}`);

  return NextResponse.json({ matched: true, matchId: match.id });
}

/**
 * DELETE /api/h2h/queue — Leave the queue
 */
export async function DELETE() {
  const player = await getAuthenticatedPlayer();
  if (!player) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Remove from queue
  const entries = await redis.zrange('h2h:queue', 0, -1);
  const toRemove = entries.filter((e) => {
    const parsed = JSON.parse(e as string);
    return parsed.playerId === player.id;
  });
  if (toRemove.length > 0) {
    await redis.zrem('h2h:queue', ...toRemove as string[]);
  }
  await redis.del(`h2h:queue:player:${player.id}`);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/h2h/queue/route.ts
git commit -m "feat: add h2h matchmaking queue (join, poll, leave, ghost timeout)"
```

---

### Task 5: Match Answer & Result API

**Files:**
- Create: `app/api/h2h/match/[id]/answer/route.ts`
- Create: `app/api/h2h/match/[id]/route.ts`

Handles answer submission during a match, checking correctness, broadcasting progress, and computing results.

- [ ] **Step 1: Create match state endpoint**

```typescript
// app/api/h2h/match/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

/**
 * GET /api/h2h/match/[id] — Get match state (for reconnection or initial load)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdminClient();

  const { data: match } = await supabase
    .from('h2h_matches')
    .select('*')
    .eq('id', id)
    .single();

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  // Get answers for this match
  const { data: answers } = await supabase
    .from('h2h_match_answers')
    .select('player_id, card_index, correct, time_from_render_ms')
    .eq('match_id', id)
    .order('card_index', { ascending: true });

  // Get player info
  const playerIds = [match.player1_id, match.player2_id].filter(Boolean);
  const { data: players } = await supabase
    .from('players')
    .select('id, display_name')
    .in('id', playerIds);

  const playerMap = new Map((players ?? []).map((p) => [p.id, p.display_name]));

  return NextResponse.json({
    match: {
      id: match.id,
      status: match.status,
      player1: { id: match.player1_id, name: playerMap.get(match.player1_id) ?? 'Unknown' },
      player2: match.player2_id
        ? { id: match.player2_id, name: playerMap.get(match.player2_id) ?? 'Ghost' }
        : null,
      isGhostMatch: match.is_ghost_match,
      isRated: match.is_rated,
      winnerId: match.winner_id,
      player1PointsDelta: match.player1_points_delta,
      player2PointsDelta: match.player2_points_delta,
      startedAt: match.started_at,
      endedAt: match.ended_at,
    },
    answers: answers ?? [],
  });
}
```

- [ ] **Step 2: Create answer submission endpoint**

```typescript
// app/api/h2h/match/[id]/answer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  H2H_CARDS_PER_MATCH, CURRENT_SEASON,
  getRankFromPoints, calculatePointsDelta,
} from '@/lib/h2h';

async function getPlayerId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = getSupabaseAdminClient();
    const { data } = await admin.from('players').select('id').eq('auth_id', user.id).single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/h2h/match/[id]/answer
 * Body: { cardIndex: number, userAnswer: 'phishing' | 'legit', timeFromRenderMs: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { cardIndex, userAnswer, timeFromRenderMs } = await req.json();

  if (cardIndex == null || !userAnswer || timeFromRenderMs == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (!['phishing', 'legit'].includes(userAnswer)) {
    return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
  }

  // Prevent duplicate answers
  const checkedKey = `match-checked:${matchId}:${playerId}:${cardIndex}`;
  const alreadyChecked = await redis.get(checkedKey);
  if (alreadyChecked) {
    return NextResponse.json({ error: 'Already answered' }, { status: 409 });
  }

  // Get match cards from Redis
  const cardsJson = await redis.get<string>(`match-cards:${matchId}`);
  if (!cardsJson) {
    return NextResponse.json({ error: 'Match expired' }, { status: 404 });
  }

  const cards = typeof cardsJson === 'string' ? JSON.parse(cardsJson) : cardsJson;
  const card = cards[cardIndex];
  if (!card) {
    return NextResponse.json({ error: 'Invalid card index' }, { status: 400 });
  }

  // Server-side verification
  const correct = (userAnswer === 'phishing') === card.isPhishing;

  // Mark as checked
  await redis.set(checkedKey, '1', { ex: 60 * 30 });

  // Record answer in DB
  const supabase = getSupabaseAdminClient();
  await supabase.from('h2h_match_answers').insert({
    match_id: matchId,
    player_id: playerId,
    card_index: cardIndex,
    card_id: card.id,
    correct,
    user_answer: userAnswer,
    time_from_render_ms: timeFromRenderMs,
  });

  // Update match progress
  const isPlayer1 = await isMatchPlayer1(supabase, matchId, playerId);
  const progressCol = isPlayer1 ? 'player1_cards_completed' : 'player2_cards_completed';
  const timeCol = isPlayer1 ? 'player1_time_ms' : 'player2_time_ms';

  if (correct) {
    // Increment cards completed
    const { data: match } = await supabase
      .from('h2h_matches')
      .select(`${progressCol}, ${timeCol}, player1_id, player2_id, status`)
      .eq('id', matchId)
      .single();

    if (!match || match.status !== 'active') {
      return NextResponse.json({ correct, eliminated: false, finished: false });
    }

    const newCompleted = ((match as Record<string, number>)[progressCol] ?? 0) + 1;
    const currentTotalTime = ((match as Record<string, number>)[timeCol] ?? 0) + timeFromRenderMs;

    const updateData: Record<string, unknown> = {
      [progressCol]: newCompleted,
      [timeCol]: currentTotalTime,
    };

    // Check if player finished all cards
    const finished = newCompleted >= H2H_CARDS_PER_MATCH;
    if (finished) {
      // Check if opponent also finished
      const oppProgressCol = isPlayer1 ? 'player2_cards_completed' : 'player1_cards_completed';
      const oppCompleted = (match as Record<string, number>)[oppProgressCol] ?? 0;

      if (oppCompleted >= H2H_CARDS_PER_MATCH) {
        // Both finished — determine winner by time
        const oppTimeCol = isPlayer1 ? 'player2_time_ms' : 'player1_time_ms';
        const oppTime = (match as Record<string, number>)[oppTimeCol] ?? Infinity;
        const winnerId = currentTotalTime <= oppTime ? playerId : (isPlayer1 ? match.player2_id : match.player1_id);

        await finalizeMatch(supabase, matchId, winnerId, updateData);
      } else {
        await supabase.from('h2h_matches').update(updateData).eq('id', matchId);
      }
    } else {
      await supabase.from('h2h_matches').update(updateData).eq('id', matchId);
    }

    return NextResponse.json({
      correct: true,
      eliminated: false,
      finished,
      cardIndex,
      totalTimeMs: currentTotalTime,
    });
  } else {
    // Wrong answer — eliminated
    // Check if opponent also got eliminated or finished
    const { data: match } = await supabase
      .from('h2h_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (match && match.status === 'active') {
      const oppProgressCol = isPlayer1 ? 'player2_cards_completed' : 'player1_cards_completed';
      const oppCompleted = (match as Record<string, number>)[oppProgressCol] ?? 0;
      const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

      // Check if opponent was also eliminated
      const { count: oppWrongCount } = await supabase
        .from('h2h_match_answers')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', matchId)
        .eq('player_id', opponentId)
        .eq('correct', false);

      if ((oppWrongCount ?? 0) > 0) {
        // Both eliminated — higher card index wins (got further)
        const winnerId = cardIndex >= (oppCompleted) ? playerId : opponentId;
        await finalizeMatch(supabase, matchId, winnerId, { [progressCol]: cardIndex });
      } else if (oppCompleted >= H2H_CARDS_PER_MATCH) {
        // Opponent already finished — they win
        await finalizeMatch(supabase, matchId, opponentId, { [progressCol]: cardIndex });
      }
      // Otherwise, opponent is still playing — match stays active
    }

    return NextResponse.json({
      correct: false,
      eliminated: true,
      finished: false,
      cardIndex,
    });
  }
}

async function isMatchPlayer1(supabase: ReturnType<typeof getSupabaseAdminClient>, matchId: string, playerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('h2h_matches')
    .select('player1_id')
    .eq('id', matchId)
    .single();
  return data?.player1_id === playerId;
}

async function finalizeMatch(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matchId: string,
  winnerId: string | null,
  additionalUpdate: Record<string, unknown>,
) {
  const { data: match } = await supabase
    .from('h2h_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!match || match.status !== 'active') return;

  let p1Delta = 0;
  let p2Delta = 0;

  if (match.is_rated && winnerId && match.player2_id) {
    // Get both players' stats
    const [{ data: p1Stats }, { data: p2Stats }] = await Promise.all([
      supabase.from('h2h_player_stats').select('*').eq('player_id', match.player1_id).eq('season', CURRENT_SEASON).single(),
      supabase.from('h2h_player_stats').select('*').eq('player_id', match.player2_id).eq('season', CURRENT_SEASON).single(),
    ]);

    const p1Points = p1Stats?.rank_points ?? 0;
    const p2Points = p2Stats?.rank_points ?? 0;
    const p1Tier = getRankFromPoints(p1Points).tier;
    const p2Tier = getRankFromPoints(p2Points).tier;
    const p1Today = p1Stats?.rated_matches_today ?? 0;
    const p2Today = p2Stats?.rated_matches_today ?? 0;

    const p1Won = winnerId === match.player1_id;
    p1Delta = calculatePointsDelta(p1Won ? p1Tier : p2Tier, p1Won ? p2Tier : p1Tier, p1Won, p1Today);
    p2Delta = calculatePointsDelta(p1Won ? p2Tier : p1Tier, p1Won ? p1Tier : p2Tier, !p1Won, p2Today);

    // Update both players' stats
    await upsertPlayerStats(supabase, match.player1_id, p1Won, p1Delta);
    await upsertPlayerStats(supabase, match.player2_id, !p1Won, p2Delta);
  }

  await supabase.from('h2h_matches').update({
    ...additionalUpdate,
    status: 'complete',
    winner_id: winnerId,
    player1_points_delta: p1Delta,
    player2_points_delta: p2Delta,
    player1_rank_tier: match.player1_rank_tier,
    player2_rank_tier: match.player2_rank_tier,
    ended_at: new Date().toISOString(),
  }).eq('id', matchId);
}

async function upsertPlayerStats(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  playerId: string,
  won: boolean,
  pointsDelta: number,
) {
  const { data: existing } = await supabase
    .from('h2h_player_stats')
    .select('*')
    .eq('player_id', playerId)
    .eq('season', CURRENT_SEASON)
    .single();

  const today = new Date().toISOString().slice(0, 10);

  if (existing) {
    const isNewDay = existing.last_match_date !== today;
    const newPoints = Math.max(0, existing.rank_points + pointsDelta);
    const newStreak = won ? existing.win_streak + 1 : 0;

    await supabase.from('h2h_player_stats').update({
      rank_points: newPoints,
      wins: existing.wins + (won ? 1 : 0),
      losses: existing.losses + (won ? 0 : 1),
      win_streak: newStreak,
      best_win_streak: Math.max(existing.best_win_streak, newStreak),
      peak_rank_points: Math.max(existing.peak_rank_points, newPoints),
      rated_matches_today: isNewDay ? 1 : existing.rated_matches_today + 1,
      last_match_date: today,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    const newPoints = Math.max(0, pointsDelta);
    await supabase.from('h2h_player_stats').insert({
      player_id: playerId,
      season: CURRENT_SEASON,
      rank_points: newPoints,
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
      win_streak: won ? 1 : 0,
      best_win_streak: won ? 1 : 0,
      peak_rank_points: newPoints,
      rated_matches_today: 1,
      last_match_date: today,
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/h2h/match/
git commit -m "feat: add h2h match state and answer submission with rank point calculation"
```

---

### Task 6: H2H Stats & Leaderboard API

**Files:**
- Create: `app/api/h2h/stats/route.ts`
- Create: `app/api/h2h/leaderboard/route.ts`

- [ ] **Step 1: Create player stats endpoint**

```typescript
// app/api/h2h/stats/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { CURRENT_SEASON, getRankFromPoints } from '@/lib/h2h';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: player } = await admin.from('players').select('id').eq('auth_id', user.id).single();
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const { data: stats } = await admin
    .from('h2h_player_stats')
    .select('*')
    .eq('player_id', player.id)
    .eq('season', CURRENT_SEASON)
    .single();

  const rankPoints = stats?.rank_points ?? 0;
  const rank = getRankFromPoints(rankPoints);

  return NextResponse.json({
    season: CURRENT_SEASON,
    rankPoints,
    rank: rank.tier,
    rankLabel: rank.label,
    rankColor: rank.color,
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
    winStreak: stats?.win_streak ?? 0,
    bestWinStreak: stats?.best_win_streak ?? 0,
    peakRankPoints: stats?.peak_rank_points ?? 0,
    ratedMatchesToday: stats?.rated_matches_today ?? 0,
  });
}
```

- [ ] **Step 2: Create leaderboard endpoint**

```typescript
// app/api/h2h/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { CURRENT_SEASON, getRankFromPoints } from '@/lib/h2h';

export async function GET() {
  const supabase = getSupabaseAdminClient();

  const { data } = await supabase
    .from('h2h_player_stats')
    .select('player_id, rank_points, wins, losses, players!player_id(display_name)')
    .eq('season', CURRENT_SEASON)
    .order('rank_points', { ascending: false })
    .limit(20);

  const leaderboard = (data ?? []).map((row, i) => {
    const rank = getRankFromPoints(row.rank_points);
    const player = Array.isArray(row.players) ? row.players[0] : row.players;
    return {
      position: i + 1,
      displayName: (player as { display_name: string | null })?.display_name ?? 'Unknown',
      rankPoints: row.rank_points,
      rankTier: rank.tier,
      rankLabel: rank.label,
      rankColor: rank.color,
      wins: row.wins,
      losses: row.losses,
    };
  });

  return NextResponse.json({ season: CURRENT_SEASON, leaderboard });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/h2h/stats/route.ts app/api/h2h/leaderboard/route.ts
git commit -m "feat: add h2h player stats and seasonal leaderboard endpoints"
```

---

### Task 7: Supabase Realtime — Match Broadcast Helper

**Files:**
- Create: `lib/h2h-realtime.ts`

Client-side helper for subscribing to and broadcasting match events via Supabase Realtime.

- [ ] **Step 1: Create the realtime helper**

```typescript
// lib/h2h-realtime.ts
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface MatchProgressEvent {
  playerId: string;
  cardIndex: number;
  correct: boolean;
  timestamp: number;
}

export interface MatchResultEvent {
  winnerId: string | null;
  player1PointsDelta: number;
  player2PointsDelta: number;
  reason: 'completed' | 'eliminated' | 'forfeit';
}

let channel: RealtimeChannel | null = null;

export function subscribeToMatch(
  matchId: string,
  playerId: string,
  onOpponentProgress: (event: MatchProgressEvent) => void,
  onMatchResult: (event: MatchResultEvent) => void,
) {
  const supabase = getSupabaseBrowserClient();

  channel = supabase.channel(`match:${matchId}`, {
    config: { broadcast: { self: false } },
  });

  channel
    .on('broadcast', { event: 'progress' }, ({ payload }) => {
      if (payload.playerId !== playerId) {
        onOpponentProgress(payload as MatchProgressEvent);
      }
    })
    .on('broadcast', { event: 'result' }, ({ payload }) => {
      onMatchResult(payload as MatchResultEvent);
    })
    .subscribe();

  return channel;
}

export function broadcastProgress(
  matchId: string,
  playerId: string,
  cardIndex: number,
  correct: boolean,
) {
  if (!channel) return;
  channel.send({
    type: 'broadcast',
    event: 'progress',
    payload: {
      playerId,
      cardIndex,
      correct,
      timestamp: Date.now(),
    } satisfies MatchProgressEvent,
  });
}

export function broadcastResult(
  matchId: string,
  result: MatchResultEvent,
) {
  if (!channel) return;
  channel.send({
    type: 'broadcast',
    event: 'result',
    payload: result,
  });
}

export function unsubscribeFromMatch() {
  if (channel) {
    channel.unsubscribe();
    channel = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/h2h-realtime.ts
git commit -m "feat: add Supabase Realtime broadcast helper for h2h matches"
```

---

### Task 8: H2H Matchmaking UI Component

**Files:**
- Create: `components/H2HQueue.tsx`

The matchmaking queue screen — shows VS layout while searching, handles ghost timeout.

- [ ] **Step 1: Create the queue component**

Build the component with:
- Player info on the left (name, rank, points)
- "???" scanning animation on the right
- Poll `/api/h2h/queue` every 2 seconds
- Cancel button calls `DELETE /api/h2h/queue`
- On match found, call `onMatchFound(matchId)`
- Show ghost indicator when ghost timeout triggers
- Timer counting up from 0 showing queue wait time

This component follows the existing terminal aesthetic (term-border, monospace green-on-black, var(--c-*) CSS variables).

- [ ] **Step 2: Commit**

```bash
git add components/H2HQueue.tsx
git commit -m "feat: add h2h matchmaking queue UI component"
```

---

### Task 9: H2H Match Game Component

**Files:**
- Create: `components/H2HMatch.tsx`

The in-match game component — shows cards, opponent progress bar, handles answers and elimination.

- [ ] **Step 1: Create the match component**

Build with:
- Opponent progress bar at top (filled/empty squares for cards 1-5)
- Standard email card display (reuse GameCard's email rendering pattern)
- PHISHING / LEGIT buttons only (no confidence selector)
- Forfeit button (subtle, corner)
- No feedback between cards — immediate next card on correct
- On wrong answer: show elimination screen with "PLAY IT OUT" and "BACK" options
- On all 5 correct: show waiting for opponent (if they haven't finished)
- Subscribe to Supabase Realtime for opponent progress updates
- Broadcast own progress after each answer
- Track per-card render time for timing

- [ ] **Step 2: Commit**

```bash
git add components/H2HMatch.tsx
git commit -m "feat: add h2h in-match game component with realtime opponent tracking"
```

---

### Task 10: H2H Match Result Component

**Files:**
- Create: `components/H2HResult.tsx`

The post-match result screen.

- [ ] **Step 1: Create the result component**

Build with:
- VICTORY / DEFEAT / DRAW headline
- Both players' card completion and total time
- Rank point change (+25, -18, etc.) with new rank if changed
- Rank tier badge with colour
- REMATCH button (re-queues) and BACK TO TERMINAL button
- Ghost match indicator (UNRATED) when applicable
- Win streak display if > 1

- [ ] **Step 2: Commit**

```bash
git add components/H2HResult.tsx
git commit -m "feat: add h2h match result screen with rank progression"
```

---

### Task 11: H2H Game Flow Integration

**Files:**
- Modify: `components/Game.tsx` — add h2h phases and flow
- Modify: `components/StartScreen.tsx` — add H2H button and rank display

- [ ] **Step 1: Add H2H phases to Game.tsx**

Add new phases to the GamePhase type:
```typescript
type GamePhase = 'start' | 'playing' | 'checking' | 'feedback'
  | 'summary' | 'daily_complete' | 'loading'
  | 'research_intro' | 'research_unavailable' | 'tutorial'
  | 'h2h_queue' | 'h2h_match' | 'h2h_result';
```

Add state for H2H:
```typescript
const [h2hMatchId, setH2HMatchId] = useState<string | null>(null);
```

Add phase rendering for h2h_queue, h2h_match, h2h_result using the new components.

Wire up the flow: `h2h_queue` → (match found) → `h2h_match` → (match ends) → `h2h_result` → (back/rematch) → `start` or `h2h_queue`.

- [ ] **Step 2: Add H2H button to StartScreen.tsx**

Add a prominent H2H button below the mode row:
- Styled with `border: 2px solid rgba(255,0,128,0.5)` to stand out
- Shows current rank tier, points, and "SEASON 0"
- Locked with "Complete research to unlock" if not graduated
- Calls `onStart('h2h')` when clicked
- Fetches rank from `/api/h2h/stats` on mount (if graduated)

- [ ] **Step 3: Add H2H leaderboard tab to StartScreen.tsx**

Add a third leaderboard tab `'h2h'` alongside `'xp'` and `'daily'`:
- Fetches from `/api/h2h/leaderboard`
- Shows rank badge colour, display name, rank points, W/L record
- Only visible to graduated players

- [ ] **Step 4: Commit**

```bash
git add components/Game.tsx components/StartScreen.tsx
git commit -m "feat: integrate h2h flow into Game.tsx and add H2H button + leaderboard to StartScreen"
```

---

### Task 12: End-to-End Testing

**Files:**
- Create: `e2e/h2h.spec.ts`

- [ ] **Step 1: Write basic H2H flow test**

Test the following flow with two test accounts:
1. Both players join the queue
2. Match is created
3. Both players answer all 5 cards correctly
4. Faster player wins
5. Rank points updated correctly

Also test:
- Queue cancel
- Ghost match (single player, 30s timeout)
- Elimination on wrong answer

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/h2h.spec.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add e2e/h2h.spec.ts
git commit -m "test: add e2e tests for h2h matchmaking, match flow, and ranking"
```

---

### Task 13: Changelog & Version Bump

**Files:**
- Modify: `lib/changelog.ts` — add v2.0.0 entry
- Modify: `package.json` — bump version to 2.0.0

- [ ] **Step 1: Add changelog entries**

Add a research timeline milestone:
```typescript
{
  date: '2026-XX-XX', // actual release date
  category: 'milestone',
  title: 'v2.0 — Head-to-Head competitive mode',
  body: 'Real-time 1v1 matchmaking. Race through 5 emails. Wrong answer eliminates. Fastest perfect run wins. Seasonal ranked tiers from Bronze to Elite. Requires research graduation to unlock.',
},
```

Add a platform update:
```typescript
{
  date: '2026-XX-XX',
  category: 'update',
  title: 'v2.0.0 — Head-to-Head mode',
  body: 'New competitive mode: match against another player in real time. 5 cards, same deck, pure speed. Wrong answer eliminates you. Ranked progression across 7 tiers (Bronze to Elite) with seasonal resets. Ghost matches when no opponent is available.',
},
```

- [ ] **Step 2: Bump package.json version**

```json
"version": "2.0.0"
```

- [ ] **Step 3: Commit**

```bash
git add lib/changelog.ts package.json
git commit -m "feat: v2.0.0 — head-to-head competitive mode"
```
