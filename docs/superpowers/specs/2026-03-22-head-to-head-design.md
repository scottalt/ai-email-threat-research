# Head-to-Head Competitive Mode — v2.0

**Date:** 2026-03-22
**Status:** Design approved
**Target:** v2.0 release — Season 0 (beta)

---

## Overview

Real-time 1v1 matchmaking mode where two players race through the same 5-card deck. Wrong answer eliminates you. Both correct — fastest total time wins. Ranked progression with seasonal tiers. Requires research graduation to unlock.

---

## Match Rules

- **5 cards** per match, drawn from freeplay + expert pools combined
- Both players see the **same cards in the same order** (seeded from a shared deck)
- **No confidence selector** — just PHISHING / LEGIT buttons (pure speed)
- **Wrong answer = eliminated** instantly
  - Eliminated player sees opponent's continued progress
  - Option to "play it out" for practice (no ranked impact on remaining cards)
- **Both players go 5/5** — fastest total time (card render to final answer) wins
- **Forfeit** — player can quit mid-match, counts as a loss

---

## Ranked System

### Tiers

| Tier | Points range | Colour |
|------|-------------|--------|
| BRONZE | 0 - 99 | `#003a0e` (dim green) |
| SILVER | 100 - 249 | `#00aa28` (green) |
| GOLD | 250 - 449 | `#ffaa00` (amber) |
| PLATINUM | 450 - 699 | `#00aaff` (blue) |
| DIAMOND | 700 - 999 | `#ff0080` (pink) |
| MASTER | 1000 - 1399 | `#ff3333` (red) |
| ELITE | 1400+ | `#ffd700` (gold) |

### Point Scaling (rank-difference based)

Points earned/lost scale based on the tier gap between opponents:

| Scenario | Win | Loss |
|----------|-----|------|
| Opponent **2+ tiers above** | +45 | -8 |
| Opponent **1 tier above** | +35 | -12 |
| Opponent **same tier** | +25 | -18 |
| Opponent **1 tier below** | +18 | -25 |
| Opponent **2+ tiers below** | +12 | -30 |

- Floor at 0 points (can't go negative)
- **Daily cap:** first 10 matches award full points, matches 11-20 award 50%, after 20 no points (can still play for fun)

### Seasons

- **Season 0:** beta period, no fixed end date
- Season reset rules TBD based on Season 0 data
- End-of-season badge showing peak rank (future feature)

---

## Matchmaking

### Queue Flow

1. Player clicks H2H button on start screen
2. Player enters matchmaking queue (Redis sorted set, keyed by timestamp)
3. Server polls every 2 seconds for a match
4. When two players are queued:
   - Server creates a match record
   - Generates shared 5-card deck (seeded, deterministic order)
   - Stores deck in Redis
   - Notifies both players via Supabase Realtime Broadcast
5. Both players enter the match simultaneously

### Timeout — Ghost Matches

- If no opponent found within **30 seconds**, match against a ghost
- Ghost = recorded run from a previous completed match (stored answer times per card)
- Ghost matches are **unrated** (no ranked points gained or lost)
- Player sees "GHOST MATCH" indicator so there's no confusion
- Ghost opponent shows a display name and rank from the original player

### Matchmaking Preferences

- Prefer opponents within **1 tier** of the player's rank
- After 10 seconds, widen to **2 tiers**
- After 20 seconds, widen to **any tier**
- After 30 seconds, fall back to ghost

---

## Real-Time Communication

### Technology: Supabase Realtime Broadcast

Each match gets a Broadcast channel: `match:{matchId}`

### Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `match:start` | Server → Both | `{ matchId, cards, opponentName, opponentRank }` |
| `match:progress` | Player → Opponent | `{ playerId, cardIndex, timestamp }` |
| `match:eliminated` | Server → Both | `{ playerId, cardIndex }` |
| `match:finished` | Server → Both | `{ playerId, totalTimeMs }` |
| `match:result` | Server → Both | `{ winnerId, p1Score, p2Score, rankChange }` |
| `match:forfeit` | Player → Server | `{ playerId }` |

### Flow

1. Both players subscribe to `match:{matchId}` channel
2. On each correct answer, player broadcasts `match:progress` with their card index
3. On wrong answer, server broadcasts `match:eliminated`
4. On completing all 5, server broadcasts `match:finished`
5. Server compares results and broadcasts `match:result` with winner and rank changes

---

## Card Dealing

- Source: combined freeplay + expert card pools (`cards_generated` table, `pool IN ('freeplay', 'expert')`)
- **5 cards** per match (not 10)
- Deck generated server-side with a match-specific seed
- Both players receive identical cards in identical order
- Cards stored in Redis: `match-cards:{matchId}` with 30-minute TTL
- Answer verification uses existing `/api/cards/check` pattern (per-card, server-side)

---

## Data Model

### `h2h_matches` table

```sql
CREATE TABLE h2h_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL DEFAULT 'season-0',
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID REFERENCES players(id),  -- null for ghost matches
  ghost_run_id UUID REFERENCES h2h_matches(id),  -- source match for ghost replay
  card_ids TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'active', 'complete', 'cancelled')),
  winner_id UUID REFERENCES players(id),
  player1_time_ms INT,
  player2_time_ms INT,
  player1_cards_completed SMALLINT DEFAULT 0,
  player2_cards_completed SMALLINT DEFAULT 0,
  player1_rank_before TEXT,
  player2_rank_before TEXT,
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
```

### `h2h_match_answers` table

```sql
CREATE TABLE h2h_match_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES h2h_matches(id),
  player_id UUID NOT NULL REFERENCES players(id),
  card_index SMALLINT NOT NULL,  -- 0-4
  card_id TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  user_answer TEXT NOT NULL CHECK (user_answer IN ('phishing', 'legit')),
  time_from_render_ms INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, player_id, card_index)
);

CREATE INDEX idx_h2h_answers_match ON h2h_match_answers(match_id);
CREATE INDEX idx_h2h_answers_player ON h2h_match_answers(player_id);
```

### `h2h_player_stats` table

```sql
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
  matches_today SMALLINT NOT NULL DEFAULT 0,
  last_match_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season)
);

CREATE INDEX idx_h2h_stats_season_points ON h2h_player_stats(season, rank_points DESC);
CREATE INDEX idx_h2h_stats_player ON h2h_player_stats(player_id);
```

---

## API Endpoints

### `POST /api/h2h/queue` — Join matchmaking queue
- Requires auth + research graduation
- Adds player to Redis queue: `h2h:queue` (sorted set, score = timestamp)
- Returns `{ queued: true, position: number }`

### `GET /api/h2h/queue/poll` — Poll for match
- Client polls every 2s
- Server checks if two players are queued, creates match if so
- Returns `{ matched: false }` or `{ matched: true, matchId, channel }`
- After 30s: returns `{ matched: true, matchId, channel, isGhost: true }`

### `DELETE /api/h2h/queue` — Leave queue
- Removes player from Redis queue

### `POST /api/h2h/match/{id}/answer` — Submit answer
- Verifies card against Redis-stored deck
- Records answer + timing
- Broadcasts progress or elimination via Supabase Realtime
- Returns `{ correct, eliminated, finished, cardIndex }`

### `POST /api/h2h/match/{id}/forfeit` — Forfeit match
- Marks player as eliminated, broadcasts to opponent
- Awards win to opponent

### `GET /api/h2h/match/{id}` — Get match state
- Returns current match state (for reconnection)

### `GET /api/h2h/stats` — Get player H2H stats
- Returns rank, points, win/loss, streak, season info

### `GET /api/h2h/leaderboard` — Seasonal leaderboard
- Top players by rank points for current season

---

## UI Screens

### Start Screen
- Prominent H2H button below mode row (option A)
- Shows current rank tier, points, and season
- Locked state with "Complete research to unlock" if not graduated

### Matchmaking Queue
- VS screen with player info on left, "???" scanning on right
- Cancel button
- 30s countdown before ghost fallback

### In-Match
- Opponent progress bar at top (filled squares for completed cards)
- Standard email card display (no confidence selector)
- PHISHING / LEGIT buttons only
- Forfeit option (subtle, corner placement)
- No feedback between cards — just next card immediately

### Elimination Screen
- "ELIMINATED — wrong answer on card X/5"
- Shows opponent's continued progress in real time
- Two options: "PLAY IT OUT" (continue for practice) or "BACK TO TERMINAL"

### Match Result
- Winner/loser display with rank point change
- Both players' card completion and time
- REMATCH and QUEUE AGAIN buttons

### H2H Leaderboard
- Seasonal tab on the existing leaderboard section
- Shows: rank, display name, rank points, W/L record

---

## Redis Keys

| Key | Value | TTL |
|-----|-------|-----|
| `h2h:queue` | Sorted set (score=timestamp, member=playerId) | Members expire via cleanup |
| `h2h:queue:player:{playerId}` | `1` | 60s (prevents double-queue) |
| `match-cards:{matchId}` | Card[] JSON | 30 min |
| `match-checked:{matchId}:{playerId}:{cardIndex}` | `1` | 30 min |
| `match-state:{matchId}` | Match progress JSON | 30 min |
| `ratelimit:h2h-queue:{ip}` | counter | 60s (5 queues/min) |

---

## Ghost System

- When a rated match completes with both players going 5/5, the winning run is stored as a potential ghost
- Ghost data = array of 5 answer times (ms per card) from the original match
- Ghost matches simulate the opponent answering at those recorded intervals
- Server broadcasts fake `match:progress` events on a timer matching the ghost's recorded pace
- Ghost always goes 5/5 correct (they're replays of winning runs)
- If the player beats the ghost's total time, they win. Otherwise they lose.
- Ghost matches are always unrated

---

## Unlock Gate

Same as expert mode: `research_graduated = true` on the player record. Players must complete 30 research answers (3 sessions) before H2H unlocks.

---

## Future Considerations (not in Season 0)

- **Technique identification:** after clicking PHISHING, pick the technique for bonus points or time penalty
- **Streak multiplier:** later cards worth more within a match
- **Cosmetics/shop:** badges, titles, card skins that opponents can see
- **Season rewards:** end-of-season badge based on peak rank
- **Season reset rules:** full reset vs soft reset (drop N tiers)
- **Best-of-3 matches:** optional longer format
- **Spectator mode:** watch live matches
- **Challenge a friend:** share a link to play a specific match seed
