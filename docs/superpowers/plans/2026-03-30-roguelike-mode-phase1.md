# Roguelike Mode Phase 1 — Core Loop MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable roguelike survival mode with 3 floors, lives, Intel economy, perk shop, scoring, and leaderboard.

**Architecture:** New `RoguelikeRun` component manages the run lifecycle (lobby → floor → shop → floor → ... → result). Server-side run state in Redis tracks lives, Intel, perks, floor progress, and card assignments. Supabase stores completed run records and the roguelike card pool. Leaderboard uses Redis sorted sets (same pattern as daily/global).

**Tech Stack:** Next.js App Router, Supabase (Postgres), Upstash Redis, existing component patterns (GameCard, Handler, LevelMeter).

**Spec:** `docs/superpowers/specs/2026-03-30-roguelike-mode-design.md`

**Phase 1 Scope (from spec §14):**
- Floors 1-3 with Tier 1 + Tier 2 gimmicks (FIRST LOOK, TRIAGE, UNDER PRESSURE, INVESTIGATION, DECEPTION, BLACKOUT, CONFIDENCE)
- Basic card pool (50-80 cards) using `cards_generated` table with `pool = 'roguelike'`
- 5 card modifiers (LOOKALIKE_DOMAIN, AI_ENHANCED, TIMED, REDACTED_SENDER, DECOY_RED_FLAGS)
- Intel economy + perk shop (10 perks)
- 3 lives, no permanent upgrades yet (Phase 2)
- Basic scoring + leaderboard (best run score)
- SIGINT run start/end dialogue
- Homepage integration (Priority Stack layout)

---

## File Structure

### New Files

```
lib/roguelike.ts                          — Constants, types, gimmick/modifier definitions, scoring formulas
lib/roguelike-cards.ts                    — Card modifier application logic, deck building, floor card selection
lib/roguelike-perks.ts                    — Perk definitions, shop logic, perk effect application
lib/roguelike-gimmicks.ts                 — Gimmick definitions, floor assignment, gimmick-specific UI config
lib/roguelike-operations.ts               — Operation name generator (adjective + noun pools)

components/RoguelikeRun.tsx               — Top-level run orchestrator (lobby → floor → shop → result)
components/RoguelikeFloor.tsx             — Single floor: renders cards with gimmick + modifiers
components/RoguelikePerkShop.tsx          — Between-floor perk selection screen
components/RoguelikeResult.tsx            — End-of-run summary (score, clearance, leaderboard position)
components/RoguelikeLobby.tsx             — Pre-run screen (start button, best run, upgrades preview)
components/RoguelikeHUD.tsx               — In-floor overlay (lives, Intel, floor #, streak, modifiers)
components/RoguelikeCard.tsx              — Card display with modifier effects (extends GameCard patterns)
components/RoguelikeInbox.tsx             — TRIAGE gimmick: 3-card inbox layout
components/RoguelikeWager.tsx             — CONFIDENCE gimmick: wager UI overlay

app/api/roguelike/start/route.ts          — POST: initialize run, assign gimmicks, deal floor 1
app/api/roguelike/[runId]/answer/route.ts — POST: submit answer, verify, update state
app/api/roguelike/[runId]/shop/route.ts   — GET: available perks. POST: purchase perk
app/api/roguelike/[runId]/next-floor/route.ts — POST: advance to next floor, deal cards
app/api/roguelike/[runId]/route.ts        — GET: current run state. PATCH: end run
app/api/roguelike/leaderboard/route.ts    — GET: roguelike leaderboard

supabase/migrations/20260330000000_create-roguelike-tables.sql — DB tables
```

### Modified Files

```
lib/types.ts                              — Add 'roguelike' to GameMode union
components/Game.tsx                       — Add roguelike phase routing
components/StartScreen.tsx                — Add DEADLOCK button + leaderboard tab
lib/sounds.ts                             — Add roguelike-specific sounds (floor clear, perk buy, life lost)
lib/sigint-personality.ts                 — Add roguelike dialogue moments
lib/achievements.ts                       — Add roguelike achievement definitions (Phase 1: 3 basic ones)
lib/achievement-checker.ts                — Add roguelike achievement checks
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260330000000_create-roguelike-tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Roguelike mode tables

-- Run records
CREATE TABLE IF NOT EXISTS roguelike_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  operation_name TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  floor_reached SMALLINT NOT NULL DEFAULT 0,
  floors_cleared SMALLINT NOT NULL DEFAULT 0,
  lives_remaining SMALLINT NOT NULL DEFAULT 3,
  lives_max SMALLINT NOT NULL DEFAULT 3,
  intel_earned INT NOT NULL DEFAULT 0,
  intel_spent INT NOT NULL DEFAULT 0,
  clearance_earned INT NOT NULL DEFAULT 0,
  gimmick_assignments JSONB NOT NULL DEFAULT '[]',
  perks_purchased TEXT[] DEFAULT '{}',
  cards_answered SMALLINT NOT NULL DEFAULT 0,
  cards_correct SMALLINT NOT NULL DEFAULT 0,
  best_streak SMALLINT NOT NULL DEFAULT 0,
  deaths SMALLINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roguelike_runs_player ON roguelike_runs(player_id);
CREATE INDEX IF NOT EXISTS idx_roguelike_runs_score ON roguelike_runs(score DESC);
CREATE INDEX IF NOT EXISTS idx_roguelike_runs_status ON roguelike_runs(status);

ALTER TABLE roguelike_runs ENABLE ROW LEVEL SECURITY;

-- Player permanent upgrade state (for Phase 2, create table now)
CREATE TABLE IF NOT EXISTS roguelike_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  upgrade_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, upgrade_id)
);

CREATE INDEX IF NOT EXISTS idx_roguelike_upgrades_player ON roguelike_upgrades(player_id);
ALTER TABLE roguelike_upgrades ENABLE ROW LEVEL SECURITY;

-- Add roguelike clearance to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS roguelike_clearance INT NOT NULL DEFAULT 0;

-- Add roguelike pool to cards_generated check constraint
ALTER TABLE cards_generated DROP CONSTRAINT IF EXISTS cards_generated_pool_check;
ALTER TABLE cards_generated ADD CONSTRAINT cards_generated_pool_check
  CHECK (pool IN ('freeplay', 'expert', 'roguelike'));
```

- [ ] **Step 2: Run migration against dev DB**

Run the SQL in the Supabase SQL editor for the dev project. Verify tables created:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'roguelike%';
```
Expected: `roguelike_runs`, `roguelike_upgrades`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260330000000_create-roguelike-tables.sql
git commit -m "feat(roguelike): create DB tables for runs and upgrades"
```

---

## Task 2: Core Types & Constants

**Files:**
- Create: `lib/roguelike.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Add 'roguelike' to GameMode type**

In `lib/types.ts`, find the `GameMode` type and add `'roguelike'`:

```typescript
export type GameMode = 'freeplay' | 'daily' | 'research' | 'preview' | 'expert' | 'h2h' | 'roguelike';
```

- [ ] **Step 2: Create lib/roguelike.ts with core types and constants**

```typescript
// ── Roguelike Mode — Core Types & Constants ──

export const ROGUELIKE_FLOORS = 3; // Phase 1: 3 floors (Phase 3 adds floors 4-5)
export const ROGUELIKE_CARDS_PER_FLOOR = 5;
export const ROGUELIKE_DEFAULT_LIVES = 3;
export const ROGUELIKE_MAX_LIVES = 5;
export const ROGUELIKE_SESSION_TTL = 60 * 60; // 1 hour Redis TTL

// ── Intel Economy ──
export const INTEL_CORRECT = 10;
export const INTEL_SPEED_BONUS = 5;       // answered in < 5s
export const INTEL_SPEED_THRESHOLD_MS = 5000;
export const INTEL_STREAK_BONUS = 3;      // per streak count (3+ correct)
export const INTEL_STREAK_MIN = 3;
export const INTEL_FLOOR_CLEAR = 15;
export const INTEL_WRONG = -5;
export const INTEL_WAGER_MULTIPLIER = 2;  // correct wager pays 2x
export const INTEL_WAGER_OPTIONS = [5, 10, 20] as const;

// ── Clearance Economy ──
export const CLEARANCE_PER_FLOOR = [5, 10, 20, 35, 50]; // indexed by floor (0-based)
export const CLEARANCE_FULL_CLEAR = 25;
export const CLEARANCE_NO_DEATHS = 15;

// ── Scoring ──
export const SCORE_CORRECT_BASE = 100;
export const SCORE_FLOOR_MULTIPLIER = [1, 1.5, 2, 3, 4]; // indexed by floor (0-based)
export const SCORE_SPEED_BONUS = 50;
export const SCORE_MODIFIER_BONUS = 25;   // per active modifier on the card
export const SCORE_WRONG_BASE = -50;
export const SCORE_DEATH_PENALTY = -100;
export const SCORE_FLOOR_CLEAR = 200;
export const SCORE_FULL_CLEAR = 500;
export const SCORE_NO_DEATHS = 300;
export const SCORE_STREAK_BONUS = 20;     // per card in best streak

// ── Floor Difficulty ──
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export const FLOOR_DIFFICULTY: Record<number, Difficulty[]> = {
  0: ['easy'],
  1: ['easy', 'medium'],
  2: ['medium', 'hard'],
  3: ['hard', 'extreme'],    // Phase 3
  4: ['extreme'],            // Phase 3
};

export const FLOOR_MODIFIER_RANGE: Record<number, [number, number]> = {
  0: [0, 1],
  1: [0, 1],
  2: [1, 2],
  3: [2, 3], // Phase 3
  4: [2, 3], // Phase 3
};

// ── Card Modifiers ──
export type CardModifier =
  | 'LOOKALIKE_DOMAIN'
  | 'DECOY_RED_FLAGS'
  | 'AI_ENHANCED'
  | 'TIMED'
  | 'REDACTED_SENDER';

export const ALL_MODIFIERS: CardModifier[] = [
  'LOOKALIKE_DOMAIN',
  'DECOY_RED_FLAGS',
  'AI_ENHANCED',
  'TIMED',
  'REDACTED_SENDER',
];

export interface ModifierDef {
  id: CardModifier;
  label: string;
  description: string;
  color: string;
}

export const MODIFIER_DEFS: Record<CardModifier, ModifierDef> = {
  LOOKALIKE_DOMAIN:  { id: 'LOOKALIKE_DOMAIN',  label: 'LOOKALIKE DOMAIN',  description: 'Subtle character swaps in sender', color: '#ffaa00' },
  DECOY_RED_FLAGS:   { id: 'DECOY_RED_FLAGS',   label: 'DECOY RED FLAGS',   description: 'Legit email looks suspicious',     color: '#ff3333' },
  AI_ENHANCED:       { id: 'AI_ENHANCED',        label: 'AI-ENHANCED',       description: 'Flawless phishing prose',          color: '#bf5fff' },
  TIMED:             { id: 'TIMED',              label: 'TIMED',             description: 'Auto-submits after countdown',     color: '#00d4ff' },
  REDACTED_SENDER:   { id: 'REDACTED_SENDER',    label: 'REDACTED SENDER',   description: 'From address hidden',             color: '#888888' },
};

// ── Gimmick Types ──
export type GimmickId =
  | 'FIRST_LOOK' | 'TRIAGE' | 'QUICK_SCAN'                        // Tier 1
  | 'UNDER_PRESSURE' | 'INVESTIGATION' | 'DECEPTION'               // Tier 2
  | 'BLACKOUT' | 'CHAIN_MAIL' | 'DOUBLE_AGENT' | 'CONFIDENCE';    // Tier 2

export type GimmickTier = 1 | 2 | 3;

export interface GimmickDef {
  id: GimmickId;
  tier: GimmickTier;
  label: string;
  description: string;
  color: string;
}

export const GIMMICK_DEFS: Record<GimmickId, GimmickDef> = {
  FIRST_LOOK:      { id: 'FIRST_LOOK',      tier: 1, label: 'FIRST LOOK',      description: 'Standard cards. No tricks.',                          color: '#00ff41' },
  TRIAGE:          { id: 'TRIAGE',           tier: 1, label: 'TRIAGE',           description: 'Inbox of 3 emails. Find the phish.',                 color: '#00ff41' },
  QUICK_SCAN:      { id: 'QUICK_SCAN',       tier: 1, label: 'QUICK SCAN',      description: '8 easy cards in 60 seconds.',                        color: '#00ff41' },
  UNDER_PRESSURE:  { id: 'UNDER_PRESSURE',   tier: 2, label: 'UNDER PRESSURE',  description: 'Ticking timer per card.',                            color: '#00d4ff' },
  INVESTIGATION:   { id: 'INVESTIGATION',    tier: 2, label: 'INVESTIGATION',   description: 'Inspect elements. Each costs Intel.',                color: '#00d4ff' },
  DECEPTION:       { id: 'DECEPTION',        tier: 2, label: 'DECEPTION',       description: 'Decoy red flags. Flawless phishing.',                color: '#ffaa00' },
  BLACKOUT:        { id: 'BLACKOUT',         tier: 2, label: 'BLACKOUT',        description: 'Sender or subject redacted.',                        color: '#888888' },
  CHAIN_MAIL:      { id: 'CHAIN_MAIL',       tier: 2, label: 'CHAIN MAIL',      description: 'Email threads with injected messages.',               color: '#ffaa00' },
  DOUBLE_AGENT:    { id: 'DOUBLE_AGENT',     tier: 2, label: 'DOUBLE AGENT',    description: 'Two emails. Pick the phish.',                        color: '#bf5fff' },
  CONFIDENCE:      { id: 'CONFIDENCE',       tier: 2, label: 'CONFIDENCE',      description: 'Wager Intel on your answers.',                       color: '#ff3333' },
};

export const TIER1_GIMMICKS: GimmickId[] = ['FIRST_LOOK', 'TRIAGE', 'QUICK_SCAN'];
export const TIER2_GIMMICKS: GimmickId[] = ['UNDER_PRESSURE', 'INVESTIGATION', 'DECEPTION', 'BLACKOUT', 'CONFIDENCE'];
// Phase 1: skip CHAIN_MAIL and DOUBLE_AGENT (require special card formats)

// ── Perk Types ──
export type PerkId =
  | 'EXTRA_LIFE' | 'FIREWALL'                                       // Defense
  | 'THREAT_BRIEF' | 'PATTERN_LOCK'                                 // Intelligence
  | 'BOUNTY_HUNTER' | 'ADRENALINE' | 'STREAK_MASTER'               // Offense
  | 'TIME_DILATION' | 'REROLL' | 'ARCHIVE';                         // Utility

export type PerkCategory = 'defense' | 'intelligence' | 'offense' | 'utility';

export interface PerkDef {
  id: PerkId;
  name: string;
  description: string;
  cost: number;
  category: PerkCategory;
  icon: string;
  color: string;
}

export const PERK_DEFS: PerkDef[] = [
  // Defense
  { id: 'EXTRA_LIFE',     name: 'EXTRA LIFE',     description: '+1 life (max 5)',                          cost: 30, category: 'defense',       icon: '🛡️', color: '#00ff41' },
  { id: 'FIREWALL',       name: 'FIREWALL',       description: 'Skip one card entirely (once per floor)',  cost: 35, category: 'defense',       icon: '🔒', color: '#00ff41' },
  // Intelligence
  { id: 'THREAT_BRIEF',   name: 'THREAT BRIEF',   description: 'Reveals # of phishing cards next floor',  cost: 15, category: 'intelligence',  icon: '📋', color: '#00d4ff' },
  { id: 'PATTERN_LOCK',   name: 'PATTERN LOCK',   description: 'Highlights one technique next floor',      cost: 20, category: 'intelligence',  icon: '🎯', color: '#00d4ff' },
  // Offense
  { id: 'BOUNTY_HUNTER',  name: 'BOUNTY HUNTER',  description: '+50% Intel for correct answers next floor', cost: 15, category: 'offense',      icon: '💰', color: '#ffaa00' },
  { id: 'ADRENALINE',     name: 'ADRENALINE',     description: 'Speed bonus threshold +3s',                cost: 10, category: 'offense',       icon: '⚡', color: '#ffaa00' },
  { id: 'STREAK_MASTER',  name: 'STREAK MASTER',  description: 'Streaks count from 2 instead of 3',       cost: 15, category: 'offense',       icon: '🔥', color: '#ffaa00' },
  // Utility
  { id: 'TIME_DILATION',  name: 'TIME DILATION',  description: '+5s on all timed cards',                   cost: 15, category: 'utility',       icon: '⏱️', color: '#bf5fff' },
  { id: 'REROLL',         name: 'REROLL',         description: 'Reroll one card (once per floor)',          cost: 10, category: 'utility',       icon: '🔄', color: '#bf5fff' },
  { id: 'ARCHIVE',        name: 'ARCHIVE',        description: 'View last 3 answered cards',               cost: 15, category: 'utility',       icon: '🗃️', color: '#bf5fff' },
];

export const PERKS_OFFERED_PER_SHOP = 3;

// ── Run State (stored in Redis during active run) ──
export interface RoguelikeRunState {
  runId: string;
  playerId: string;
  operationName: string;
  floor: number;                    // 0-indexed current floor
  cardIndex: number;                // current card within floor (0-4)
  lives: number;
  livesMax: number;
  intel: number;
  score: number;
  streak: number;
  bestStreak: number;
  deaths: number;
  cardsAnswered: number;
  cardsCorrect: number;
  gimmicks: GimmickId[];            // assigned gimmick per floor
  perks: PerkId[];                  // purchased perks (active for rest of run)
  floorCards: string[];             // card IDs for current floor (from Redis)
  answeredCardIds: string[];        // all card IDs answered this run (no repeats)
  status: 'floor' | 'shop' | 'complete' | 'dead';
  // Perk state
  firewallUsed: boolean;            // FIREWALL: one skip per floor
  rerollUsed: boolean;              // REROLL: one reroll per floor
}

// ── Leaderboard Entry ──
export interface RoguelikeLeaderboardEntry {
  name: string;
  score: number;
  floorReached: number;
  deaths: number;
  operationName: string;
  nameEffect?: string | null;
  themeColor?: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/roguelike.ts lib/types.ts
git commit -m "feat(roguelike): core types, constants, and economy definitions"
```

---

## Task 3: Operation Name Generator

**Files:**
- Create: `lib/roguelike-operations.ts`

- [ ] **Step 1: Create the operation name generator**

```typescript
// Generates random operation names like "OPERATION: GLASS NEEDLE"

const ADJECTIVES = [
  'GLASS', 'DEAD', 'COLD', 'DARK', 'BLIND', 'GHOST', 'IRON',
  'SILENT', 'BROKEN', 'BLACK', 'FROZEN', 'HOLLOW', 'LOST',
  'SHADOW', 'BURNT', 'SPLIT', 'DEEP', 'THIN', 'SHARP', 'GRAY',
  'FADING', 'HIDDEN', 'PALE', 'STATIC', 'WIRED', 'COVERT',
  'RAPID', 'FINAL', 'ROGUE', 'ZERO',
];

const NOUNS = [
  'NEEDLE', 'CIRCUIT', 'SIGNAL', 'VORTEX', 'THREAD', 'CIPHER',
  'FRACTURE', 'PULSE', 'VECTOR', 'TRACE', 'PRISM', 'LATTICE',
  'SPARK', 'RELAY', 'BREACH', 'VERTEX', 'HORIZON', 'STATIC',
  'PAYLOAD', 'SOCKET', 'MIRROR', 'NEXUS', 'DRIFT', 'SURGE',
  'CASCADE', 'FLARE', 'ECHO', 'PHANTOM', 'SERPENT', 'ANVIL',
];

export function generateOperationName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `OPERATION: ${adj} ${noun}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/roguelike-operations.ts
git commit -m "feat(roguelike): operation name generator"
```

---

## Task 4: Gimmick Assignment & Floor Setup

**Files:**
- Create: `lib/roguelike-gimmicks.ts`

- [ ] **Step 1: Create gimmick assignment logic**

```typescript
import {
  ROGUELIKE_FLOORS, TIER1_GIMMICKS, TIER2_GIMMICKS,
  type GimmickId,
} from './roguelike';

/** Shuffle array in place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assign gimmicks to each floor for a run.
 * Floor 0 = random Tier 1, Floors 1-2 = random Tier 2 (no repeats).
 * Phase 3 will add Floor 3-4 with Tier 2 + Tier 3.
 */
export function assignGimmicks(floorCount: number = ROGUELIKE_FLOORS): GimmickId[] {
  const tier1 = shuffle(TIER1_GIMMICKS);
  const tier2 = shuffle(TIER2_GIMMICKS);

  const gimmicks: GimmickId[] = [];

  // Floor 0: Tier 1
  gimmicks.push(tier1[0]);

  // Floors 1+: Tier 2 (pick without replacement)
  for (let i = 1; i < floorCount; i++) {
    gimmicks.push(tier2[i - 1]);
  }

  return gimmicks;
}

/**
 * Get the timer duration (ms) for a timed card on a given floor.
 * Returns null if no timer applies.
 */
export function getTimerDuration(gimmick: GimmickId, floor: number): number | null {
  if (gimmick !== 'UNDER_PRESSURE') return null;
  // Tighter timer on higher floors
  const baseDuration = 15000; // 15s
  const reductionPerFloor = 2000;
  return Math.max(8000, baseDuration - floor * reductionPerFloor);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/roguelike-gimmicks.ts
git commit -m "feat(roguelike): gimmick assignment and floor setup logic"
```

---

## Task 5: Card Selection & Modifier Assignment

**Files:**
- Create: `lib/roguelike-cards.ts`

- [ ] **Step 1: Create card selection and modifier logic**

```typescript
import {
  ROGUELIKE_CARDS_PER_FLOOR,
  FLOOR_DIFFICULTY, FLOOR_MODIFIER_RANGE,
  ALL_MODIFIERS,
  type CardModifier, type Difficulty,
} from './roguelike';

/** Shuffle array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random int in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface RoguelikeCardAssignment {
  cardId: string;
  modifiers: CardModifier[];
}

/**
 * Select cards for a floor from the available pool.
 * Filters by difficulty tier, excludes already-used cards, shuffles, and assigns modifiers.
 */
export function selectFloorCards(
  availableCards: { card_id: string; difficulty: string; is_phishing: boolean }[],
  floor: number,
  excludeCardIds: string[],
  count: number = ROGUELIKE_CARDS_PER_FLOOR,
): RoguelikeCardAssignment[] {
  const difficulties = FLOOR_DIFFICULTY[floor] ?? ['medium'];
  const excludeSet = new Set(excludeCardIds);

  // Filter to eligible cards
  const eligible = availableCards.filter(
    (c) => difficulties.includes(c.difficulty as Difficulty) && !excludeSet.has(c.card_id)
  );

  // Ensure a mix of phishing and legit (at least 1 of each, rest random)
  const phishing = shuffle(eligible.filter((c) => c.is_phishing));
  const legit = shuffle(eligible.filter((c) => !c.is_phishing));

  const selected: typeof eligible = [];
  if (phishing.length > 0) selected.push(phishing[0]);
  if (legit.length > 0) selected.push(legit[0]);

  // Fill remaining from shuffled pool (excluding already selected)
  const selectedIds = new Set(selected.map((c) => c.card_id));
  const remaining = shuffle(eligible.filter((c) => !selectedIds.has(c.card_id)));
  for (const card of remaining) {
    if (selected.length >= count) break;
    selected.push(card);
  }

  // Shuffle the final selection order
  const finalCards = shuffle(selected);

  // Assign random modifiers per card
  const [minMods, maxMods] = FLOOR_MODIFIER_RANGE[floor] ?? [0, 1];

  return finalCards.map((card) => {
    const modCount = randInt(minMods, maxMods);
    const modifiers = shuffle([...ALL_MODIFIERS]).slice(0, modCount);
    return { cardId: card.card_id, modifiers };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/roguelike-cards.ts
git commit -m "feat(roguelike): card selection and modifier assignment logic"
```

---

## Task 6: Perk Shop Logic

**Files:**
- Create: `lib/roguelike-perks.ts`

- [ ] **Step 1: Create perk shop logic**

```typescript
import {
  PERK_DEFS, PERKS_OFFERED_PER_SHOP, ROGUELIKE_MAX_LIVES,
  type PerkId, type PerkDef, type RoguelikeRunState,
} from './roguelike';

/** Shuffle array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Get available perks for the shop.
 * Excludes already-purchased one-time perks, respects max lives, etc.
 */
export function getShopOfferings(
  state: RoguelikeRunState,
  count: number = PERKS_OFFERED_PER_SHOP,
): PerkDef[] {
  const owned = new Set(state.perks);

  const available = PERK_DEFS.filter((p) => {
    // EXTRA_LIFE: only if below max
    if (p.id === 'EXTRA_LIFE' && state.lives >= ROGUELIKE_MAX_LIVES) return false;
    // Stackable perks (can buy again): EXTRA_LIFE, BOUNTY_HUNTER
    const stackable: PerkId[] = ['EXTRA_LIFE', 'BOUNTY_HUNTER'];
    if (!stackable.includes(p.id) && owned.has(p.id)) return false;
    return true;
  });

  return shuffle(available).slice(0, count);
}

/**
 * Apply a perk purchase to the run state. Returns updated state.
 */
export function applyPerkPurchase(
  state: RoguelikeRunState,
  perkId: PerkId,
): RoguelikeRunState {
  const perk = PERK_DEFS.find((p) => p.id === perkId);
  if (!perk) return state;
  if (state.intel < perk.cost) return state;

  const updated = { ...state };
  updated.intel -= perk.cost;
  updated.perks = [...state.perks, perkId];

  // Immediate effects
  if (perkId === 'EXTRA_LIFE') {
    updated.lives = Math.min(state.lives + 1, ROGUELIKE_MAX_LIVES);
    updated.livesMax = Math.max(updated.livesMax, updated.lives);
  }

  return updated;
}

/**
 * Check if a perk is active in the current run state.
 */
export function hasPerk(state: RoguelikeRunState, perkId: PerkId): boolean {
  return state.perks.includes(perkId);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/roguelike-perks.ts
git commit -m "feat(roguelike): perk shop selection and purchase logic"
```

---

## Task 7: Scoring & Clearance Calculation

**Files:**
- Modify: `lib/roguelike.ts` (add scoring functions at the bottom)

- [ ] **Step 1: Add scoring functions to lib/roguelike.ts**

Append to the end of `lib/roguelike.ts`:

```typescript
// ── Scoring Functions ──

export function calculateCardScore(
  correct: boolean,
  floor: number,
  modifierCount: number,
  answeredInMs: number,
  speedThresholdMs: number = INTEL_SPEED_THRESHOLD_MS,
): { score: number; intel: number; speedBonus: boolean } {
  const multiplier = SCORE_FLOOR_MULTIPLIER[floor] ?? 1;

  if (!correct) {
    return {
      score: Math.round(SCORE_WRONG_BASE * multiplier),
      intel: INTEL_WRONG,
      speedBonus: false,
    };
  }

  let score = Math.round(SCORE_CORRECT_BASE * multiplier);
  let intel = INTEL_CORRECT;
  const speedBonus = answeredInMs < speedThresholdMs;

  if (speedBonus) {
    score += SCORE_SPEED_BONUS;
    intel += INTEL_SPEED_BONUS;
  }

  score += SCORE_MODIFIER_BONUS * modifierCount;

  return { score, intel, speedBonus };
}

export function calculateStreakIntel(streak: number, streakMin: number = INTEL_STREAK_MIN): number {
  if (streak < streakMin) return 0;
  return INTEL_STREAK_BONUS * streak;
}

export function calculateRunClearance(floorsCleared: number, deaths: number, totalFloors: number): number {
  let clearance = 0;

  for (let i = 0; i < floorsCleared; i++) {
    clearance += CLEARANCE_PER_FLOOR[i] ?? 0;
  }

  if (floorsCleared >= totalFloors) {
    clearance += CLEARANCE_FULL_CLEAR;
  }

  if (deaths === 0 && floorsCleared > 0) {
    clearance += CLEARANCE_NO_DEATHS;
  }

  return clearance;
}

export function calculateFinalScore(
  baseScore: number,
  floorsCleared: number,
  deaths: number,
  bestStreak: number,
  totalFloors: number,
): number {
  let score = baseScore;

  score += SCORE_FLOOR_CLEAR * floorsCleared;

  if (floorsCleared >= totalFloors) {
    score += SCORE_FULL_CLEAR;
  }

  if (deaths === 0 && floorsCleared > 0) {
    score += SCORE_NO_DEATHS;
  }

  score += SCORE_STREAK_BONUS * bestStreak;
  score += SCORE_DEATH_PENALTY * deaths;

  return Math.max(0, score);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/roguelike.ts
git commit -m "feat(roguelike): scoring and clearance calculation functions"
```

---

## Task 8: API — Start Run

**Files:**
- Create: `app/api/roguelike/start/route.ts`

- [ ] **Step 1: Create the run initialization endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { generateOperationName } from '@/lib/roguelike-operations';
import { assignGimmicks } from '@/lib/roguelike-gimmicks';
import { selectFloorCards } from '@/lib/roguelike-cards';
import {
  ROGUELIKE_FLOORS, ROGUELIKE_DEFAULT_LIVES, ROGUELIKE_SESSION_TTL,
  ROGUELIKE_CARDS_PER_FLOOR,
  type RoguelikeRunState,
} from '@/lib/roguelike';

export async function POST(req: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();

  // Check player exists and is graduated
  const { data: player } = await admin
    .from('players')
    .select('id, research_graduated')
    .eq('auth_id', user.id)
    .single();

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  if (!player.research_graduated) {
    return NextResponse.json({ error: 'Complete research mode first' }, { status: 403 });
  }

  // Check no active run
  const activeKey = `roguelike:active:${player.id}`;
  const existingRunId = await redis.get<string>(activeKey);
  if (existingRunId) {
    return NextResponse.json({ error: 'Run already active', runId: existingRunId }, { status: 409 });
  }

  // Generate run
  const operationName = generateOperationName();
  const gimmicks = assignGimmicks(ROGUELIKE_FLOORS);

  // Fetch roguelike card pool
  const { data: cardPool } = await admin
    .from('cards_generated')
    .select('card_id, difficulty, is_phishing')
    .eq('pool', 'roguelike');

  if (!cardPool || cardPool.length < ROGUELIKE_FLOORS * ROGUELIKE_CARDS_PER_FLOOR) {
    // Fall back to freeplay pool if roguelike pool isn't populated yet
    const { data: fallbackPool } = await admin
      .from('cards_generated')
      .select('card_id, difficulty, is_phishing')
      .in('pool', ['freeplay', 'expert']);
    if (!fallbackPool || fallbackPool.length < ROGUELIKE_FLOORS * ROGUELIKE_CARDS_PER_FLOOR) {
      return NextResponse.json({ error: 'Not enough cards available' }, { status: 500 });
    }
    cardPool.push(...fallbackPool);
  }

  // Select cards for floor 0
  const floor0Cards = selectFloorCards(cardPool, 0, []);

  // Create DB record
  const { data: run, error: runError } = await admin
    .from('roguelike_runs')
    .insert({
      player_id: player.id,
      operation_name: operationName,
      gimmick_assignments: gimmicks,
      lives_remaining: ROGUELIKE_DEFAULT_LIVES,
      lives_max: ROGUELIKE_DEFAULT_LIVES,
    })
    .select('id')
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
  }

  // Fetch full card data for floor 0 (server-side, answers included)
  const floor0CardIds = floor0Cards.map((c) => c.cardId);
  const { data: fullCards } = await admin
    .from('cards_generated')
    .select('*')
    .in('card_id', floor0CardIds);

  // Store run state in Redis
  const state: RoguelikeRunState = {
    runId: run.id,
    playerId: player.id,
    operationName,
    floor: 0,
    cardIndex: 0,
    lives: ROGUELIKE_DEFAULT_LIVES,
    livesMax: ROGUELIKE_DEFAULT_LIVES,
    intel: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    deaths: 0,
    cardsAnswered: 0,
    cardsCorrect: 0,
    gimmicks,
    perks: [],
    floorCards: floor0CardIds,
    answeredCardIds: [],
    status: 'floor',
    firewallUsed: false,
    rerollUsed: false,
  };

  await redis.set(`roguelike:run:${run.id}`, JSON.stringify(state), { ex: ROGUELIKE_SESSION_TTL });
  await redis.set(activeKey, run.id, { ex: ROGUELIKE_SESSION_TTL });

  // Store full cards server-side (for answer verification)
  await redis.set(`roguelike:cards:${run.id}:0`, JSON.stringify(fullCards), { ex: ROGUELIKE_SESSION_TTL });

  // Store floor card assignments (modifiers) for client
  await redis.set(`roguelike:assignments:${run.id}:0`, JSON.stringify(floor0Cards), { ex: ROGUELIKE_SESSION_TTL });

  // Return safe card data (no answers) + run info
  const safeCards = (fullCards ?? []).map((c) => ({
    _idx: floor0CardIds.indexOf(c.card_id),
    type: c.type,
    from: c.from_address,
    subject: c.subject,
    body: c.body,
  }));

  return NextResponse.json({
    runId: run.id,
    operationName,
    floor: 0,
    gimmick: gimmicks[0],
    lives: ROGUELIKE_DEFAULT_LIVES,
    intel: 0,
    cards: safeCards,
    cardAssignments: floor0Cards, // includes modifiers per card
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/roguelike/start/route.ts
git commit -m "feat(roguelike): POST /api/roguelike/start — initialize run"
```

---

## Task 9: API — Answer Submission

**Files:**
- Create: `app/api/roguelike/[runId]/answer/route.ts`

- [ ] **Step 1: Create the answer verification endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';
import {
  ROGUELIKE_CARDS_PER_FLOOR, ROGUELIKE_SESSION_TTL,
  INTEL_FLOOR_CLEAR,
  calculateCardScore, calculateStreakIntel,
  type RoguelikeRunState,
} from '@/lib/roguelike';
import { hasPerk } from '@/lib/roguelike-perks';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  // Auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Parse body
  const { cardIndex, userAnswer, timeFromRenderMs, wager } = await req.json();
  if (typeof cardIndex !== 'number' || !['phishing', 'legit'].includes(userAnswer)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Load run state
  const stateJson = await redis.get<string>(`roguelike:run:${runId}`);
  if (!stateJson) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  const state: RoguelikeRunState = JSON.parse(stateJson);

  if (state.status !== 'floor') {
    return NextResponse.json({ error: 'Not in floor phase' }, { status: 400 });
  }
  if (cardIndex !== state.cardIndex) {
    return NextResponse.json({ error: 'Wrong card index' }, { status: 400 });
  }

  // Load server-side cards for this floor
  const cardsJson = await redis.get<string>(`roguelike:cards:${runId}:${state.floor}`);
  if (!cardsJson) return NextResponse.json({ error: 'Floor cards not found' }, { status: 500 });
  const floorCards = JSON.parse(cardsJson);

  // Load assignments (modifiers)
  const assignJson = await redis.get<string>(`roguelike:assignments:${runId}:${state.floor}`);
  const assignments = assignJson ? JSON.parse(assignJson) : [];

  // Find the card
  const cardId = state.floorCards[cardIndex];
  const card = floorCards.find((c: { card_id: string }) => c.card_id === cardId);
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 500 });

  const assignment = assignments[cardIndex] ?? { modifiers: [] };
  const correct = (userAnswer === 'phishing') === card.is_phishing;

  // Speed threshold (modified by ADRENALINE perk)
  const speedThreshold = hasPerk(state, 'ADRENALINE') ? 8000 : 5000;

  // Calculate score and intel
  const { score: cardScore, intel: cardIntel, speedBonus } = calculateCardScore(
    correct,
    state.floor,
    assignment.modifiers.length,
    timeFromRenderMs ?? 99999,
    speedThreshold,
  );

  // Update state
  const updated = { ...state };
  updated.cardsAnswered++;
  updated.score += cardScore;
  updated.intel += cardIntel;
  updated.answeredCardIds = [...state.answeredCardIds, cardId];

  if (correct) {
    updated.cardsCorrect++;
    updated.streak++;
    updated.bestStreak = Math.max(updated.bestStreak, updated.streak);

    // Streak intel bonus
    const streakMin = hasPerk(state, 'STREAK_MASTER') ? 2 : 3;
    const streakIntel = calculateStreakIntel(updated.streak, streakMin);
    updated.intel += streakIntel;

    // Bounty hunter bonus
    if (hasPerk(state, 'BOUNTY_HUNTER')) {
      updated.intel += Math.round(cardIntel * 0.5);
    }
  } else {
    updated.streak = 0;
    updated.deaths++;
    updated.lives--;

    if (updated.lives <= 0) {
      updated.status = 'dead';
    }
  }

  // Handle wager
  let wagerResult: { won: boolean; amount: number } | null = null;
  if (typeof wager === 'number' && wager > 0) {
    const wagerMultiplier = hasPerk(state, 'DOUBLE_DOWN') ? 3 : 2;
    if (correct) {
      updated.intel += wager * wagerMultiplier;
      wagerResult = { won: true, amount: wager * wagerMultiplier };
    } else {
      updated.intel -= wager;
      wagerResult = { won: false, amount: -wager };
    }
  }

  // Ensure Intel doesn't go negative
  updated.intel = Math.max(0, updated.intel);

  // Check if floor is complete
  let floorCleared = false;
  if (correct && updated.cardIndex + 1 >= ROGUELIKE_CARDS_PER_FLOOR && updated.status !== 'dead') {
    floorCleared = true;
    updated.intel += INTEL_FLOOR_CLEAR;
    updated.status = 'shop';
  } else if (updated.status !== 'dead') {
    updated.cardIndex++;
  }

  // Save state
  await redis.set(`roguelike:run:${runId}`, JSON.stringify(updated), { ex: ROGUELIKE_SESSION_TTL });

  return NextResponse.json({
    correct,
    isPhishing: card.is_phishing,
    explanation: card.explanation,
    technique: card.technique,
    cardScore,
    cardIntel,
    speedBonus,
    wagerResult,
    floorCleared,
    lives: updated.lives,
    intel: updated.intel,
    score: updated.score,
    streak: updated.streak,
    status: updated.status,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/roguelike/[runId]/answer/route.ts"
git commit -m "feat(roguelike): POST /api/roguelike/[runId]/answer — answer verification"
```

---

## Task 10: API — Perk Shop & Next Floor

**Files:**
- Create: `app/api/roguelike/[runId]/shop/route.ts`
- Create: `app/api/roguelike/[runId]/next-floor/route.ts`

- [ ] **Step 1: Create perk shop endpoint**

```typescript
// app/api/roguelike/[runId]/shop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';
import { ROGUELIKE_SESSION_TTL, type RoguelikeRunState, type PerkId } from '@/lib/roguelike';
import { getShopOfferings, applyPerkPurchase } from '@/lib/roguelike-perks';

async function getAuth() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  return supabase.auth.getUser();
}

// GET: get shop offerings
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { data: { user } } = await getAuth();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const stateJson = await redis.get<string>(`roguelike:run:${runId}`);
  if (!stateJson) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  const state: RoguelikeRunState = JSON.parse(stateJson);

  if (state.status !== 'shop') {
    return NextResponse.json({ error: 'Not in shop phase' }, { status: 400 });
  }

  // Check if offerings already generated for this floor (cached in Redis)
  const shopKey = `roguelike:shop:${runId}:${state.floor}`;
  let offerings = await redis.get<string>(shopKey);
  if (!offerings) {
    const perks = getShopOfferings(state);
    offerings = JSON.stringify(perks);
    await redis.set(shopKey, offerings, { ex: ROGUELIKE_SESSION_TTL });
  }

  return NextResponse.json({
    perks: JSON.parse(offerings),
    intel: state.intel,
    lives: state.lives,
    floor: state.floor,
  });
}

// POST: purchase a perk
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { data: { user } } = await getAuth();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { perkId } = await req.json();

  const stateJson = await redis.get<string>(`roguelike:run:${runId}`);
  if (!stateJson) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  const state: RoguelikeRunState = JSON.parse(stateJson);

  if (state.status !== 'shop') {
    return NextResponse.json({ error: 'Not in shop phase' }, { status: 400 });
  }

  // Verify perk is in the current shop offerings
  const shopKey = `roguelike:shop:${runId}:${state.floor}`;
  const offeringsJson = await redis.get<string>(shopKey);
  if (offeringsJson) {
    const offerings = JSON.parse(offeringsJson);
    if (!offerings.some((p: { id: string }) => p.id === perkId)) {
      return NextResponse.json({ error: 'Perk not available' }, { status: 400 });
    }
  }

  const updated = applyPerkPurchase(state, perkId as PerkId);
  if (updated.intel === state.intel && updated.perks.length === state.perks.length) {
    return NextResponse.json({ error: 'Cannot afford perk' }, { status: 400 });
  }

  await redis.set(`roguelike:run:${runId}`, JSON.stringify(updated), { ex: ROGUELIKE_SESSION_TTL });

  return NextResponse.json({
    ok: true,
    intel: updated.intel,
    lives: updated.lives,
    perks: updated.perks,
  });
}
```

- [ ] **Step 2: Create next-floor endpoint**

```typescript
// app/api/roguelike/[runId]/next-floor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  ROGUELIKE_FLOORS, ROGUELIKE_SESSION_TTL,
  type RoguelikeRunState,
} from '@/lib/roguelike';
import { selectFloorCards } from '@/lib/roguelike-cards';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const stateJson = await redis.get<string>(`roguelike:run:${runId}`);
  if (!stateJson) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  const state: RoguelikeRunState = JSON.parse(stateJson);

  if (state.status !== 'shop') {
    return NextResponse.json({ error: 'Not in shop phase' }, { status: 400 });
  }

  const nextFloor = state.floor + 1;

  // Check if run is complete (all floors cleared)
  if (nextFloor >= ROGUELIKE_FLOORS) {
    state.status = 'complete';
    await redis.set(`roguelike:run:${runId}`, JSON.stringify(state), { ex: ROGUELIKE_SESSION_TTL });
    return NextResponse.json({ complete: true });
  }

  // Fetch card pool
  const admin = getSupabaseAdminClient();
  const { data: cardPool } = await admin
    .from('cards_generated')
    .select('card_id, difficulty, is_phishing')
    .in('pool', ['roguelike', 'freeplay', 'expert']);

  if (!cardPool) return NextResponse.json({ error: 'Card pool unavailable' }, { status: 500 });

  // Select cards for next floor (excluding already-used cards)
  const nextCards = selectFloorCards(cardPool, nextFloor, state.answeredCardIds);
  const nextCardIds = nextCards.map((c) => c.cardId);

  // Fetch full card data
  const { data: fullCards } = await admin
    .from('cards_generated')
    .select('*')
    .in('card_id', nextCardIds);

  // Update state
  const updated: RoguelikeRunState = {
    ...state,
    floor: nextFloor,
    cardIndex: 0,
    floorCards: nextCardIds,
    status: 'floor',
    firewallUsed: false,
    rerollUsed: false,
  };

  await redis.set(`roguelike:run:${runId}`, JSON.stringify(updated), { ex: ROGUELIKE_SESSION_TTL });
  await redis.set(`roguelike:cards:${runId}:${nextFloor}`, JSON.stringify(fullCards), { ex: ROGUELIKE_SESSION_TTL });
  await redis.set(`roguelike:assignments:${runId}:${nextFloor}`, JSON.stringify(nextCards), { ex: ROGUELIKE_SESSION_TTL });

  // Return safe cards
  const safeCards = (fullCards ?? []).map((c) => ({
    _idx: nextCardIds.indexOf(c.card_id),
    type: c.type,
    from: c.from_address,
    subject: c.subject,
    body: c.body,
  }));

  return NextResponse.json({
    floor: nextFloor,
    gimmick: state.gimmicks[nextFloor],
    cards: safeCards,
    cardAssignments: nextCards,
    lives: updated.lives,
    intel: updated.intel,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/roguelike/[runId]/shop/route.ts" "app/api/roguelike/[runId]/next-floor/route.ts"
git commit -m "feat(roguelike): perk shop + next-floor API endpoints"
```

---

## Task 11: API — End Run & Leaderboard

**Files:**
- Create: `app/api/roguelike/[runId]/route.ts`
- Create: `app/api/roguelike/leaderboard/route.ts`

- [ ] **Step 1: Create run state + end run endpoint**

```typescript
// app/api/roguelike/[runId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  ROGUELIKE_FLOORS, ROGUELIKE_SESSION_TTL,
  calculateFinalScore, calculateRunClearance,
  type RoguelikeRunState,
} from '@/lib/roguelike';

async function getAuth() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  return supabase.auth.getUser();
}

// GET: current run state
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { data: { user } } = await getAuth();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const stateJson = await redis.get<string>(`roguelike:run:${runId}`);
  if (!stateJson) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  const state: RoguelikeRunState = JSON.parse(stateJson);

  return NextResponse.json({
    runId: state.runId,
    operationName: state.operationName,
    floor: state.floor,
    lives: state.lives,
    intel: state.intel,
    score: state.score,
    streak: state.streak,
    bestStreak: state.bestStreak,
    deaths: state.deaths,
    perks: state.perks,
    gimmicks: state.gimmicks,
    status: state.status,
    cardsAnswered: state.cardsAnswered,
    cardsCorrect: state.cardsCorrect,
  });
}

// PATCH: end run (death, complete, or abandon)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { data: { user } } = await getAuth();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const stateJson = await redis.get<string>(`roguelike:run:${runId}`);
  if (!stateJson) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  const state: RoguelikeRunState = JSON.parse(stateJson);

  const admin = getSupabaseAdminClient();

  // Calculate floors cleared
  const floorsCleared = state.status === 'complete'
    ? ROGUELIKE_FLOORS
    : state.floor; // died on current floor, so only previous floors count

  // Final score
  const finalScore = calculateFinalScore(
    state.score, floorsCleared, state.deaths, state.bestStreak, ROGUELIKE_FLOORS,
  );

  // Clearance earned
  const clearanceEarned = calculateRunClearance(floorsCleared, state.deaths, ROGUELIKE_FLOORS);

  // Update DB record
  await admin
    .from('roguelike_runs')
    .update({
      score: finalScore,
      floor_reached: state.floor + 1,
      floors_cleared: floorsCleared,
      lives_remaining: state.lives,
      intel_earned: state.intel,
      clearance_earned: clearanceEarned,
      perks_purchased: state.perks,
      cards_answered: state.cardsAnswered,
      cards_correct: state.cardsCorrect,
      best_streak: state.bestStreak,
      deaths: state.deaths,
      status: state.status === 'complete' ? 'complete' : state.lives <= 0 ? 'complete' : 'abandoned',
      ended_at: new Date().toISOString(),
    })
    .eq('id', runId);

  // Award clearance to player
  if (clearanceEarned > 0) {
    await admin.rpc('increment_column', {
      table_name: 'players',
      column_name: 'roguelike_clearance',
      row_id: state.playerId,
      amount: clearanceEarned,
    }).catch(() => {
      // Fallback: manual update if RPC doesn't exist
      admin
        .from('players')
        .select('roguelike_clearance')
        .eq('id', state.playerId)
        .single()
        .then(({ data }) => {
          if (data) {
            admin
              .from('players')
              .update({ roguelike_clearance: (data.roguelike_clearance ?? 0) + clearanceEarned })
              .eq('id', state.playerId);
          }
        });
    });
  }

  // Update leaderboard (Redis sorted set — best score)
  const { data: playerInfo } = await admin
    .from('players')
    .select('display_name')
    .eq('id', state.playerId)
    .single();

  if (playerInfo?.display_name && finalScore > 0) {
    const lbKey = 'leaderboard:roguelike';
    const member = playerInfo.display_name;
    const existing = await redis.zscore(lbKey, member);
    if (existing === null || (existing as number) < finalScore) {
      await redis.zadd(lbKey, { score: finalScore, member });
    }
    // Also store run metadata for display
    await redis.set(`roguelike:lb-meta:${member}`, JSON.stringify({
      operationName: state.operationName,
      floorReached: state.floor + 1,
      deaths: state.deaths,
    }), { ex: 90 * 24 * 60 * 60 }); // 90 day TTL
  }

  // Clean up Redis run state
  await redis.del(`roguelike:active:${state.playerId}`);
  // Keep run state briefly for result screen
  await redis.expire(`roguelike:run:${runId}`, 300);

  return NextResponse.json({
    finalScore,
    clearanceEarned,
    floorsCleared,
    deaths: state.deaths,
    bestStreak: state.bestStreak,
    cardsAnswered: state.cardsAnswered,
    cardsCorrect: state.cardsCorrect,
    operationName: state.operationName,
  });
}
```

- [ ] **Step 2: Create leaderboard endpoint**

```typescript
// app/api/roguelike/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { THEMES } from '@/lib/themes';

export async function GET() {
  const lbKey = 'leaderboard:roguelike';

  const results = await redis.zrange(lbKey, 0, 19, {
    rev: true,
    withScores: true,
  }) as (string | number)[];

  const entries: { name: string; score: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      name: results[i] as string,
      score: results[i + 1] as number,
    });
  }

  if (entries.length === 0) return NextResponse.json([]);

  // Look up player info + run metadata
  const names = entries.map((e) => e.name);
  const admin = getSupabaseAdminClient();
  const { data: playerInfo } = await admin
    .from('players')
    .select('display_name, level, theme_id')
    .in('display_name', names);

  const playerMap: Record<string, { level: number; nameEffect: string | null; color: string }> = {};
  for (const p of playerInfo ?? []) {
    const theme = THEMES.find((t) => t.id === (p.theme_id ?? 'phosphor'));
    playerMap[p.display_name as string] = {
      level: p.level ?? 1,
      nameEffect: theme?.nameEffect ?? null,
      color: theme?.colors.primary ?? '#00ff41',
    };
    playerMap[(p.display_name as string).toLowerCase()] = playerMap[p.display_name as string];
  }

  // Fetch run metadata
  const metaPromises = names.map(async (name) => {
    const meta = await redis.get<string>(`roguelike:lb-meta:${name}`);
    return meta ? JSON.parse(meta) : null;
  });
  const metas = await Promise.all(metaPromises);

  const lookup = (name: string) => playerMap[name] ?? playerMap[name.toLowerCase()];

  return NextResponse.json(entries.map((e, i) => ({
    name: e.name,
    score: e.score,
    level: lookup(e.name)?.level ?? 1,
    nameEffect: lookup(e.name)?.nameEffect ?? null,
    themeColor: lookup(e.name)?.color ?? '#00ff41',
    operationName: metas[i]?.operationName ?? null,
    floorReached: metas[i]?.floorReached ?? null,
    deaths: metas[i]?.deaths ?? null,
  })));
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/roguelike/[runId]/route.ts" app/api/roguelike/leaderboard/route.ts
git commit -m "feat(roguelike): end run + leaderboard API endpoints"
```

---

## Task 12: SIGINT Roguelike Dialogues

**Files:**
- Modify: `lib/sigint-personality.ts`

- [ ] **Step 1: Add roguelike dialogue moments**

Add these entries to the SIGINT dialogue system (follow the existing pattern in the file — add to the `HANDLER_DIALOGUES` map or equivalent):

```typescript
// Roguelike mode dialogues
first_roguelike: {
  lines: [
    'New briefing, operative.',
    'This is DEADLOCK — a high-stakes simulation tower.',
    'Five floors of escalating threats. Three lives. Perks between floors.',
    'The emails get harder. The modifiers stack. And if you run out of lives...',
    '...you start from scratch.',
    'Good luck in there. I\'ll be on comms.',
  ],
  buttonText: 'BEGIN OPERATION',
},
roguelike_death: {
  lines: [
    'We lost containment.',
    'Debrief: you made it to floor {floor}. {correct}/{total} correct.',
    'Take what you learned and run it again.',
  ],
  buttonText: 'ACKNOWLEDGED',
},
roguelike_death_floor1: {
  lines: [
    '...',
    'You didn\'t even make it past triage.',
    'Coffee first next time.',
  ],
  buttonText: 'FAIR ENOUGH',
},
roguelike_clear: {
  lines: [
    'Tower cleared. All floors. Every threat neutralized.',
    'Operation {operation} — success.',
    'Not bad, operative. Not bad at all.',
  ],
  buttonText: 'MISSION COMPLETE',
},
roguelike_flawless: {
  lines: [
    'Flawless. Zero casualties. Perfect read on every threat.',
    'I\'m putting this one in the classified file.',
    'Operation {operation} — exemplary.',
  ],
  buttonText: 'ACKNOWLEDGED',
},
```

- [ ] **Step 2: Commit**

```bash
git add lib/sigint-personality.ts
git commit -m "feat(roguelike): SIGINT dialogue moments for run start, death, and victory"
```

---

## Task 13: Roguelike HUD Component

**Files:**
- Create: `components/RoguelikeHUD.tsx`

- [ ] **Step 1: Create the in-floor HUD overlay**

```typescript
'use client';

import { MODIFIER_DEFS, GIMMICK_DEFS, type CardModifier, type GimmickId } from '@/lib/roguelike';

interface Props {
  floor: number;
  gimmick: GimmickId;
  lives: number;
  livesMax: number;
  intel: number;
  streak: number;
  cardIndex: number;
  totalCards: number;
  modifiers: CardModifier[];
}

export function RoguelikeHUD({
  floor, gimmick, lives, livesMax, intel, streak, cardIndex, totalCards, modifiers,
}: Props) {
  const gimmickDef = GIMMICK_DEFS[gimmick];

  return (
    <div className="w-full font-mono text-xs space-y-2">
      {/* Top bar: floor + gimmick + card progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[var(--c-muted)]">FLOOR {floor + 1}</span>
          <span style={{ color: gimmickDef.color }} className="tracking-widest">
            {gimmickDef.label}
          </span>
        </div>
        <span className="text-[var(--c-muted)]">
          {cardIndex + 1}/{totalCards}
        </span>
      </div>

      {/* Stats bar: lives + intel + streak */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Lives */}
          <div className="flex items-center gap-1">
            {Array.from({ length: livesMax }).map((_, i) => (
              <span
                key={i}
                className={i < lives ? 'text-[#ff3333]' : 'text-[var(--c-dark)]'}
              >
                ♥
              </span>
            ))}
          </div>

          {/* Intel */}
          <span className="text-[#ffaa00]">{intel} Intel</span>
        </div>

        {/* Streak */}
        {streak >= 2 && (
          <span className="text-[var(--c-primary)]">
            {streak}× streak
          </span>
        )}
      </div>

      {/* Modifier badges */}
      {modifiers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {modifiers.map((mod) => {
            const def = MODIFIER_DEFS[mod];
            return (
              <span
                key={mod}
                className="px-1.5 py-0.5 text-[10px] tracking-wider border"
                style={{
                  color: def.color,
                  borderColor: `${def.color}44`,
                  background: `${def.color}12`,
                }}
              >
                {def.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RoguelikeHUD.tsx
git commit -m "feat(roguelike): HUD component showing lives, intel, floor, modifiers"
```

---

## Task 14: Perk Shop Component

**Files:**
- Create: `components/RoguelikePerkShop.tsx`

- [ ] **Step 1: Create the perk shop UI**

```typescript
'use client';

import { useState } from 'react';
import { type PerkDef, type GimmickId, GIMMICK_DEFS } from '@/lib/roguelike';
import { playClick, playCommit } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';

interface Props {
  perks: PerkDef[];
  intel: number;
  lives: number;
  floor: number;
  nextGimmick: GimmickId | null;
  sigintLine?: string;
  onBuy: (perkId: string) => Promise<void>;
  onSkip: () => void;
}

export function RoguelikePerkShop({
  perks, intel, lives, floor, nextGimmick, sigintLine, onBuy, onSkip,
}: Props) {
  const [buying, setBuying] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);
  const { soundEnabled } = useSoundEnabled();

  async function handleBuy(perkId: string) {
    if (buying || purchased) return;
    setBuying(perkId);
    if (soundEnabled) playCommit();
    await onBuy(perkId);
    setPurchased(true);
    setBuying(null);
  }

  return (
    <div className="flex flex-col items-center gap-5 p-6 font-mono max-w-md mx-auto anim-fade-in-up">
      <div className="text-center">
        <h2 className="text-[#ffaa00] text-sm tracking-[0.3em]">FIELD REQUISITION</h2>
        <p className="text-[var(--c-muted)] text-xs mt-1">Floor {floor + 1} cleared</p>
      </div>

      {/* SIGINT line */}
      {sigintLine && (
        <p className="text-[var(--c-secondary)] text-sm text-center italic">"{sigintLine}"</p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-[#ffaa00]">{intel} INTEL</span>
        <span className="text-[var(--c-muted)]">|</span>
        <span className="text-[#ff3333]">
          {Array.from({ length: lives }).map((_, i) => <span key={i}>♥</span>)}
        </span>
      </div>

      {/* Next floor preview */}
      {nextGimmick && (
        <div className="text-center text-xs text-[var(--c-muted)]">
          NEXT: <span style={{ color: GIMMICK_DEFS[nextGimmick].color }}>
            {GIMMICK_DEFS[nextGimmick].label}
          </span>
        </div>
      )}

      {/* Perk cards */}
      {!purchased && (
        <div className="w-full flex flex-col sm:flex-row gap-3">
          {perks.map((perk) => {
            const canAfford = intel >= perk.cost;
            return (
              <button
                key={perk.id}
                onClick={() => canAfford && handleBuy(perk.id)}
                disabled={!canAfford || !!buying}
                className={`flex-1 term-border p-4 text-center transition-all ${
                  canAfford
                    ? 'hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] active:scale-95 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
                } ${buying === perk.id ? 'animate-pulse' : ''}`}
                style={{ borderColor: canAfford ? `${perk.color}44` : undefined }}
              >
                <div className="text-2xl mb-2">{perk.icon}</div>
                <div className="font-bold text-sm" style={{ color: perk.color }}>{perk.name}</div>
                <div className="text-[var(--c-muted)] text-xs mt-1">{perk.description}</div>
                <div className="text-[#ffaa00] text-xs mt-2 border-t border-[var(--c-dark)] pt-2">
                  {perk.cost} Intel
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Skip / Continue */}
      <button
        onClick={() => { if (soundEnabled) playClick(); onSkip(); }}
        className="py-3 px-6 term-border text-sm tracking-widest text-[var(--c-secondary)] hover:text-[var(--c-primary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] active:scale-95 transition-all"
      >
        {purchased ? '[ NEXT FLOOR ]' : '[ SKIP — SAVE INTEL ]'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RoguelikePerkShop.tsx
git commit -m "feat(roguelike): perk shop UI component"
```

---

## Task 15: Result Screen Component

**Files:**
- Create: `components/RoguelikeResult.tsx`

- [ ] **Step 1: Create the end-of-run result screen**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { ROGUELIKE_FLOORS, GIMMICK_DEFS, type GimmickId } from '@/lib/roguelike';
import { playVictory, playDefeat } from '@/lib/sounds';
import { useSoundEnabled } from '@/lib/useSoundEnabled';
import { useSigint } from '@/lib/SigintContext';

interface Props {
  operationName: string;
  finalScore: number;
  clearanceEarned: number;
  floorsCleared: number;
  deaths: number;
  bestStreak: number;
  cardsAnswered: number;
  cardsCorrect: number;
  gimmicks: GimmickId[];
  won: boolean;
  onPlayAgain: () => void;
  onBack: () => void;
}

export function RoguelikeResult({
  operationName, finalScore, clearanceEarned, floorsCleared, deaths,
  bestStreak, cardsAnswered, cardsCorrect, gimmicks, won, onPlayAgain, onBack,
}: Props) {
  const [displayScore, setDisplayScore] = useState(0);
  const { soundEnabled } = useSoundEnabled();
  const { triggerSigint, triggerCustom } = useSigint();
  const soundPlayed = useRef(false);
  const sigintFired = useRef(false);

  // Sound
  useEffect(() => {
    if (soundPlayed.current || !soundEnabled) return;
    soundPlayed.current = true;
    if (won) playVictory(); else playDefeat();
  }, [won, soundEnabled]);

  // SIGINT
  useEffect(() => {
    if (sigintFired.current) return;
    sigintFired.current = true;
    if (won && deaths === 0) triggerSigint('roguelike_flawless');
    else if (won) triggerSigint('roguelike_clear');
    else if (floorsCleared === 0) triggerSigint('roguelike_death_floor1');
    else triggerSigint('roguelike_death');
  }, [won, deaths, floorsCleared, triggerSigint]);

  // Animated score counter
  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(finalScore * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [finalScore]);

  const accuracy = cardsAnswered > 0 ? Math.round((cardsCorrect / cardsAnswered) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-5 p-6 font-mono max-w-md mx-auto anim-fade-in-up">
      {/* Header */}
      <div className="text-center">
        <h2
          className={`text-2xl font-bold tracking-wider ${won ? 'text-[var(--c-primary)] anim-level-up' : 'text-[#ff3333]'}`}
          style={won ? { textShadow: '0 0 12px var(--c-primary), 0 0 30px rgba(0,255,65,0.3)' } : undefined}
        >
          {won ? 'TOWER CLEARED' : 'OPERATION FAILED'}
        </h2>
        <p className="text-[#ffaa00] text-sm mt-1 tracking-wider">{operationName}</p>
      </div>

      {/* Score */}
      <div className="term-border p-4 w-full text-center">
        <div className="text-[var(--c-muted)] text-xs tracking-widest">RUN SCORE</div>
        <div
          className="text-3xl font-bold tabular-nums mt-1"
          style={{ color: won ? 'var(--c-primary)' : '#ff3333' }}
        >
          {displayScore.toLocaleString()}
        </div>
      </div>

      {/* Stats */}
      <div className="term-border p-4 w-full space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--c-muted)]">FLOORS CLEARED</span>
          <span className="text-[var(--c-secondary)]">{floorsCleared}/{ROGUELIKE_FLOORS}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--c-muted)]">ACCURACY</span>
          <span className="text-[var(--c-secondary)]">{cardsCorrect}/{cardsAnswered} ({accuracy}%)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--c-muted)]">BEST STREAK</span>
          <span className="text-[var(--c-secondary)]">{bestStreak}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--c-muted)]">DEATHS</span>
          <span className={deaths > 0 ? 'text-[#ff3333]' : 'text-[var(--c-primary)]'}>{deaths}</span>
        </div>
        {clearanceEarned > 0 && (
          <div className="flex justify-between border-t border-[var(--c-dark)] pt-2 mt-2">
            <span className="text-[var(--c-muted)]">CLEARANCE EARNED</span>
            <span className="text-[#00d4ff] font-bold">+{clearanceEarned}</span>
          </div>
        )}
      </div>

      {/* Floor breakdown */}
      <div className="term-border p-3 w-full text-xs space-y-1">
        {gimmicks.slice(0, Math.max(floorsCleared + 1, 1)).map((g, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[var(--c-muted)]">FLOOR {i + 1}</span>
            <span style={{ color: i < floorsCleared ? GIMMICK_DEFS[g].color : '#ff3333' }}>
              {GIMMICK_DEFS[g].label} {i < floorsCleared ? '✓' : '✗'}
            </span>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 w-full mt-2">
        <button
          onClick={onPlayAgain}
          className="flex-1 py-3 term-border text-sm tracking-widest text-[var(--c-primary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:scale-95 transition-all"
        >
          [ NEW RUN ]
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-3 term-border text-sm tracking-widest text-[var(--c-secondary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] active:scale-95 transition-all"
        >
          [ BACK ]
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RoguelikeResult.tsx
git commit -m "feat(roguelike): result screen with animated score, stats, and floor breakdown"
```

---

## Task 16: Run Orchestrator Component

**Files:**
- Create: `components/RoguelikeRun.tsx`

This is the main component that manages the entire run lifecycle. It coordinates between floor gameplay, the perk shop, and the result screen. Due to its size and complexity, see the spec for the full state machine. The core flow is:

- [ ] **Step 1: Create the run orchestrator**

Create `components/RoguelikeRun.tsx` that:

1. Calls `POST /api/roguelike/start` on mount to initialize the run
2. Renders the current floor's cards using the existing `GameCard` component (with `RoguelikeHUD` overlay)
3. Submits answers via `POST /api/roguelike/[runId]/answer`
4. On floor clear: calls `GET /api/roguelike/[runId]/shop` and renders `RoguelikePerkShop`
5. On shop complete: calls `POST /api/roguelike/[runId]/next-floor` and starts next floor
6. On death or completion: calls `PATCH /api/roguelike/[runId]` and renders `RoguelikeResult`

State machine:
```
loading → floor → (answer loop) → shop → floor → ... → result
                                                    ↗
                    death ──────────────────────────
```

Key state:
```typescript
const [phase, setPhase] = useState<'loading' | 'floor' | 'shop' | 'result'>('loading');
const [runId, setRunId] = useState<string | null>(null);
const [operationName, setOperationName] = useState('');
const [floor, setFloor] = useState(0);
const [gimmick, setGimmick] = useState<GimmickId>('FIRST_LOOK');
const [gimmicks, setGimmicks] = useState<GimmickId[]>([]);
const [lives, setLives] = useState(3);
const [livesMax, setLivesMax] = useState(3);
const [intel, setIntel] = useState(0);
const [score, setScore] = useState(0);
const [streak, setStreak] = useState(0);
const [cards, setCards] = useState<SafeDealCard[]>([]);
const [cardAssignments, setCardAssignments] = useState<RoguelikeCardAssignment[]>([]);
const [cardIndex, setCardIndex] = useState(0);
const [perks, setPerks] = useState<PerkId[]>([]);
const [resultData, setResultData] = useState<ResultData | null>(null);
```

The component follows the same patterns as `H2HMatch.tsx`:
- Uses `useEffect` for initial data fetch
- `handleAnswer` submits to API and updates local state
- Phase transitions based on API responses
- Sound effects on correct/wrong/death/victory via `useSoundEnabled`

This file will be ~300-400 lines. Write the full implementation following the patterns from `Game.tsx` and `H2HMatch.tsx` discovered during exploration.

- [ ] **Step 2: Commit**

```bash
git add components/RoguelikeRun.tsx
git commit -m "feat(roguelike): run orchestrator component with full state machine"
```

---

## Task 17: Game.tsx Integration

**Files:**
- Modify: `components/Game.tsx`

- [ ] **Step 1: Add roguelike phase to Game.tsx**

Add import and state:
```typescript
import { RoguelikeRun } from './RoguelikeRun';

// In the component, add:
const [roguelikeActive, setRoguelikeActive] = useState(false);
```

Add handling in `handleStart`:
```typescript
if (newMode === 'roguelike') {
  setRoguelikeActive(true);
  return;
}
```

Add render case (before the main phase switch):
```typescript
if (roguelikeActive) {
  return (
    <RoguelikeRun
      onBack={() => setRoguelikeActive(false)}
      onPlayAgain={() => {
        setRoguelikeActive(false);
        setTimeout(() => setRoguelikeActive(true), 100);
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Game.tsx
git commit -m "feat(roguelike): integrate roguelike mode into Game.tsx routing"
```

---

## Task 18: Homepage Integration

**Files:**
- Modify: `components/StartScreen.tsx`

- [ ] **Step 1: Add DEADLOCK button to Stage 4 layout**

In the Stage 4 section (around line 986-998), add the roguelike button between the PVP/Daily row and Freeplay:

```typescript
// After the PVP + Daily row:
<button
  onClick={() => handleStart('roguelike')}
  className="w-full py-4 term-border font-mono font-bold tracking-widest text-sm active:scale-95 transition-all text-[#ff3333] hover:bg-[rgba(255,51,51,0.05)]"
  style={{ borderColor: 'rgba(255, 51, 51, 0.35)' }}
>
  [ DEADLOCK ]
  <div className="text-[var(--c-muted)] text-xs mt-1 font-normal tracking-wide">Roguelike Survival</div>
</button>
```

Also add a "DEADLOCK" tab to the leaderboard section, fetching from `/api/roguelike/leaderboard`.

- [ ] **Step 2: Add roguelike leaderboard tab**

Add state:
```typescript
const [roguelikeLeaderboard, setRoguelikeLeaderboard] = useState<RoguelikeLeaderboardEntry[]>([]);
```

Fetch in the leaderboard fetch function:
```typescript
const rogueRes = await fetch('/api/roguelike/leaderboard');
if (rogueRes.ok) setRoguelikeLeaderboard(await rogueRes.json());
```

Add tab button alongside XP/PvP/Daily:
```typescript
<button
  onClick={() => setActiveTab('roguelike')}
  className={`text-sm font-mono tracking-widest ${activeTab === 'roguelike' ? 'text-[#ff3333]' : 'text-[var(--c-muted)] hover:text-[var(--c-secondary)]'}`}
>
  DEADLOCK
</button>
```

Add tab content rendering the roguelike leaderboard entries (follow the pattern of the daily leaderboard).

- [ ] **Step 3: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "feat(roguelike): DEADLOCK button + leaderboard tab on homepage"
```

---

## Task 19: Seed Roguelike Card Pool

**Files:**
- Create: `scripts/seed-roguelike-cards.ts` (or run directly in Supabase SQL)

- [ ] **Step 1: Seed initial cards**

For Phase 1 MVP, we can reuse the existing freeplay/expert card pool by tagging cards with `pool = 'roguelike'`. Long-term, we'll generate roguelike-specific cards with modifiers and special formats.

Quick seed approach — duplicate a selection of freeplay cards into the roguelike pool:

```sql
-- Seed roguelike cards from existing freeplay pool (50-80 cards, mixed difficulty)
INSERT INTO cards_generated (card_id, pool, type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status, reply_to, attachment_name, sent_at)
SELECT
  'rl-' || card_id,
  'roguelike',
  type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status, reply_to, attachment_name, sent_at
FROM cards_generated
WHERE pool IN ('freeplay', 'expert')
ORDER BY random()
LIMIT 80
ON CONFLICT (card_id) DO NOTHING;
```

- [ ] **Step 2: Verify card count**

```sql
SELECT difficulty, count(*) FROM cards_generated WHERE pool = 'roguelike' GROUP BY difficulty;
```

Expected: mix of easy/medium/hard/extreme totaling ~80 cards.

- [ ] **Step 3: Commit the seed script**

```bash
git add scripts/seed-roguelike-cards.sql
git commit -m "feat(roguelike): seed roguelike card pool from existing freeplay cards"
```

---

## Task 20: Sounds & Polish

**Files:**
- Modify: `lib/sounds.ts`

- [ ] **Step 1: Add roguelike-specific sounds**

```typescript
export function playFloorClear() {
  if (!isSfxEnabled()) return;
  try {
    ensureUnlocked();
    const ctx = getCtx();
    if (ctx.state !== 'running') return;
    const t = safeNow(ctx);
    createNote(ctx, 440, t, 0.06, 0.10);
    createNote(ctx, 554, t + 0.07, 0.06, 0.10);
    createNote(ctx, 659, t + 0.14, 0.06, 0.10);
    createNote(ctx, 880, t + 0.21, 0.20, 0.14);
  } catch {}
}

export function playPerkBuy() {
  if (!isSfxEnabled()) return;
  try {
    ensureUnlocked();
    const ctx = getCtx();
    if (ctx.state !== 'running') return;
    const t = safeNow(ctx);
    createNote(ctx, 880, t, 0.04, 0.08);
    createNote(ctx, 1047, t + 0.05, 0.08, 0.10);
  } catch {}
}

export function playLifeLost() {
  if (!isSfxEnabled()) return;
  try {
    ensureUnlocked();
    const ctx = getCtx();
    if (ctx.state !== 'running') return;
    const t = safeNow(ctx);
    createNote(ctx, 330, t, 0.10, 0.12);
    createNote(ctx, 220, t + 0.12, 0.20, 0.12);
    createNote(ctx, 165, t + 0.30, 0.30, 0.10);
  } catch {}
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/sounds.ts
git commit -m "feat(roguelike): floor clear, perk buy, and life lost sound effects"
```

---

## Task 21: Type Check & Integration Test

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Manual smoke test**

1. Start dev server: `npm run dev`
2. Sign in as graduated player
3. Click DEADLOCK on home screen
4. Verify run starts (operation name, floor 1, cards load)
5. Answer cards — verify lives decrease on wrong, Intel increases on correct
6. Clear floor — verify perk shop appears
7. Buy a perk or skip — verify next floor loads
8. Die — verify result screen shows with score and clearance
9. Check leaderboard tab shows your run

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(roguelike): integration fixes from smoke testing"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | DB migration | `supabase/migrations/...` |
| 2 | Core types & constants | `lib/roguelike.ts`, `lib/types.ts` |
| 3 | Operation names | `lib/roguelike-operations.ts` |
| 4 | Gimmick assignment | `lib/roguelike-gimmicks.ts` |
| 5 | Card selection + modifiers | `lib/roguelike-cards.ts` |
| 6 | Perk shop logic | `lib/roguelike-perks.ts` |
| 7 | Scoring functions | `lib/roguelike.ts` (append) |
| 8 | API: start run | `app/api/roguelike/start/route.ts` |
| 9 | API: answer | `app/api/roguelike/[runId]/answer/route.ts` |
| 10 | API: shop + next floor | `app/api/roguelike/[runId]/shop/route.ts`, `.../next-floor/route.ts` |
| 11 | API: end run + leaderboard | `app/api/roguelike/[runId]/route.ts`, `.../leaderboard/route.ts` |
| 12 | SIGINT dialogues | `lib/sigint-personality.ts` |
| 13 | HUD component | `components/RoguelikeHUD.tsx` |
| 14 | Perk shop component | `components/RoguelikePerkShop.tsx` |
| 15 | Result screen | `components/RoguelikeResult.tsx` |
| 16 | Run orchestrator | `components/RoguelikeRun.tsx` |
| 17 | Game.tsx integration | `components/Game.tsx` |
| 18 | Homepage integration | `components/StartScreen.tsx` |
| 19 | Seed card pool | SQL seed script |
| 20 | Sounds | `lib/sounds.ts` |
| 21 | Type check + smoke test | — |
