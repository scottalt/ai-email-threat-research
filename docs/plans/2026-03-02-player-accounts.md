# Player Accounts / XP / Expert Mode — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add persistent player identity via Supabase Auth magic link, XP accumulation across sessions, a level meter, an XP leaderboard, a research graduation gate (10 research sessions → Expert Mode unlock), and an Expert Mode that serves extreme-difficulty cards outside the research dataset.

**Architecture:** Browser auth via Supabase magic link (`@supabase/ssr`). Player data stored in Supabase `players` table, accessed via our own API routes (service role) — browser never touches Supabase directly except for the auth flow itself. XP leaderboard reads from `players` table (no Redis needed). Auth session stored in HTTP-only cookies managed by `@supabase/ssr`. Everything in Game.tsx / RoundSummary is additive — no existing flows are removed.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@supabase/ssr` (new), `@supabase/supabase-js` (existing), Tailwind CSS v4, Supabase PostgreSQL, Vercel (Edge/Node runtimes)

**Branch:** `feature/player-accounts` (already created, push to origin)

---

## Pre-requisites (manual steps before coding)

### Step 0a: Run SQL in Supabase SQL Editor

```sql
-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL,
  display_name TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  research_sessions_completed INTEGER NOT NULL DEFAULT 0,
  research_graduated BOOLEAN NOT NULL DEFAULT false,
  personal_best_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link answers to players (nullable — anonymous answers still allowed)
ALTER TABLE answers ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id);

-- RLS: players can read their own row; service role bypasses RLS for all writes
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own row" ON players
  FOR SELECT USING (auth.uid() = auth_id);
```

### Step 0b: Add env vars to Vercel dashboard

In Vercel project settings → Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL` — same value as `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — same value as `SUPABASE_PUBLISHABLE_KEY`

Also add both to `.env.local` for local dev.

---

## Task 1: Install @supabase/ssr

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install the package**

Run: `npm install @supabase/ssr`

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/ssr for auth helpers"
```

---

## Task 2: lib/xp.ts — XP math and level thresholds

**Files:**
- Create: `lib/xp.ts`

**Step 1: Write the file**

```typescript
// XP earned per round outcome
export const XP_PER_CORRECT = 10;
export const XP_PER_SESSION_COMPLETE = 25; // flat bonus for finishing
export const RESEARCH_GRADUATION_SESSIONS = 10;

// 30 levels. Cumulative XP thresholds — each level takes more XP than the last.
// Level 1 = 0 XP, level 2 = 100 XP, level 30 = ~14,000 XP (rough logarithmic curve)
export const LEVEL_THRESHOLDS: number[] = (() => {
  const t = [0]; // level 1 starts at 0
  for (let i = 1; i < 30; i++) {
    // Each level requires ~15% more XP than the previous gap
    const prev = t[i - 1];
    const gap = Math.round(100 * Math.pow(1.15, i - 1));
    t.push(prev + gap);
  }
  return t;
})();

export const MAX_LEVEL = LEVEL_THRESHOLDS.length; // 30

/** XP earned from a completed round */
export function getXpForRound(correctCount: number, totalCards: number, mode: string): number {
  const correct = correctCount * XP_PER_CORRECT;
  const completionBonus = correctCount === totalCards ? 50 : XP_PER_SESSION_COMPLETE;
  // Expert mode: double XP (harder cards)
  const multiplier = mode === 'expert' ? 2 : 1;
  return (correct + completionBonus) * multiplier;
}

/** Level (1-30) for a given total XP */
export function getLevelFromXp(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

/** XP needed to reach the next level (0 if max level) */
export function xpToNextLevel(xp: number): { current: number; needed: number; level: number } {
  const level = getLevelFromXp(xp);
  if (level >= MAX_LEVEL) return { current: 0, needed: 0, level };
  const floorXp = LEVEL_THRESHOLDS[level - 1];
  const ceilXp = LEVEL_THRESHOLDS[level];
  return { current: xp - floorXp, needed: ceilXp - floorXp, level };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add lib/xp.ts
git commit -m "feat: add xp.ts with level thresholds and round XP calculation"
```

---

## Task 3: Update lib/types.ts — add 'expert' GameMode and PlayerProfile

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add 'expert' to GameMode**

Change line 33:
```typescript
// before:
export type GameMode = 'freeplay' | 'daily' | 'research' | 'preview';
// after:
export type GameMode = 'freeplay' | 'daily' | 'research' | 'preview' | 'expert';
```

**Step 2: Add PlayerProfile interface** (append after SessionPayload)

```typescript
export interface PlayerProfile {
  id: string;
  authId: string;
  displayName: string | null;
  xp: number;
  level: number;
  totalSessions: number;
  researchSessionsCompleted: number;
  researchGraduated: boolean;
  personalBestScore: number;
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (existing VALID_MODES in answers route will need updating — that's Task 12)

**Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add expert GameMode and PlayerProfile type"
```

---

## Task 4: lib/supabase-browser.ts — browser Supabase client

**Files:**
- Create: `lib/supabase-browser.ts`

**Step 1: Write the file**

```typescript
import { createBrowserClient } from '@supabase/ssr';

// Browser-only Supabase client — used ONLY for auth (signInWithOtp, getSession, onAuthStateChange, signOut)
// All data reads/writes go through our API routes which use the service role key
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return createBrowserClient(url, key);
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add lib/supabase-browser.ts
git commit -m "feat: add browser Supabase client for auth"
```

---

## Task 5: app/auth/callback/route.ts — magic link redirect handler

**Files:**
- Create: `app/auth/callback/route.ts`

**Step 1: Write the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const redirectTo = req.nextUrl.searchParams.get('next') ?? '/';

  if (!code) return NextResponse.redirect(new URL('/', req.url));

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !session) return NextResponse.redirect(new URL('/', req.url));

  // Upsert player record on first sign in
  const admin = getSupabaseAdminClient();
  await admin.from('players').upsert(
    { auth_id: session.user.id },
    { onConflict: 'auth_id', ignoreDuplicates: true }
  );

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat: add auth callback route for magic link sign-in"
```

---

## Task 6: GET/POST /api/player — player profile API

**Files:**
- Create: `app/api/player/route.ts`

**Step 1: Write the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { PlayerProfile } from '@/lib/types';

async function getAuthId(req: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function toProfile(row: Record<string, unknown>): PlayerProfile {
  return {
    id: row.id as string,
    authId: row.auth_id as string,
    displayName: row.display_name as string | null,
    xp: row.xp as number,
    level: row.level as number,
    totalSessions: row.total_sessions as number,
    researchSessionsCompleted: row.research_sessions_completed as number,
    researchGraduated: row.research_graduated as boolean,
    personalBestScore: row.personal_best_score as number,
  };
}

// GET /api/player — returns the signed-in player's profile
export async function GET(req: NextRequest) {
  const authId = await getAuthId(req);
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .select('*')
    .eq('auth_id', authId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  return NextResponse.json(toProfile(data as unknown as Record<string, unknown>));
}

// POST /api/player — update display_name
export async function POST(req: NextRequest) {
  const authId = await getAuthId(req);
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const displayName = typeof body.displayName === 'string'
    ? body.displayName.trim().slice(0, 20)
    : null;
  if (!displayName) return NextResponse.json({ error: 'Invalid display_name' }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq('auth_id', authId)
    .select('*')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json(toProfile(data as unknown as Record<string, unknown>));
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/api/player/route.ts
git commit -m "feat: add GET/POST /api/player for profile reads and display name update"
```

---

## Task 7: PATCH /api/player/xp — award XP after a round

**Files:**
- Create: `app/api/player/xp/route.ts`

**Step 1: Write the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { getLevelFromXp, RESEARCH_GRADUATION_SESSIONS } from '@/lib/xp';

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// PATCH /api/player/xp
// Body: { xpEarned: number; score: number; gameMode: string; sessionCompleted: boolean }
export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const xpEarned = Math.max(0, Math.min(1000, Number(body.xpEarned) || 0));
  const score = Number(body.score) || 0;
  const gameMode = String(body.gameMode ?? 'freeplay');
  const sessionCompleted = Boolean(body.sessionCompleted);

  const admin = getSupabaseAdminClient();
  const { data: player, error: fetchErr } = await admin
    .from('players')
    .select('id, xp, level, total_sessions, research_sessions_completed, research_graduated, personal_best_score')
    .eq('auth_id', authId)
    .single();

  if (fetchErr || !player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const p = player as Record<string, unknown>;
  const newXp = (p.xp as number) + xpEarned;
  const newLevel = getLevelFromXp(newXp);
  const levelUp = newLevel > (p.level as number);
  const newTotalSessions = sessionCompleted ? (p.total_sessions as number) + 1 : p.total_sessions as number;

  const isResearchSession = gameMode === 'research' && sessionCompleted;
  const newResearchSessions = isResearchSession
    ? (p.research_sessions_completed as number) + 1
    : p.research_sessions_completed as number;
  const wasGraduated = p.research_graduated as boolean;
  const nowGraduated = wasGraduated || newResearchSessions >= RESEARCH_GRADUATION_SESSIONS;

  const newBest = Math.max(p.personal_best_score as number, score);

  await admin.from('players').update({
    xp: newXp,
    level: newLevel,
    total_sessions: newTotalSessions,
    research_sessions_completed: newResearchSessions,
    research_graduated: nowGraduated,
    personal_best_score: newBest,
    updated_at: new Date().toISOString(),
  }).eq('auth_id', authId);

  return NextResponse.json({
    xp: newXp,
    level: newLevel,
    xpEarned,
    levelUp,
    graduated: !wasGraduated && nowGraduated,  // true only on the transition
    researchSessionsCompleted: newResearchSessions,
  });
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/api/player/xp/route.ts
git commit -m "feat: add PATCH /api/player/xp to award XP and track graduation"
```

---

## Task 8: GET /api/leaderboard/xp — XP leaderboard

**Files:**
- Create: `app/api/leaderboard/xp/route.ts`

**Step 1: Write the file**

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .select('display_name, xp, level, research_graduated')
    .order('xp', { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/api/leaderboard/xp/route.ts
git commit -m "feat: add GET /api/leaderboard/xp for top-10 XP leaderboard"
```

---

## Task 9: GET /api/cards/expert — expert mode card deck

**Files:**
- Create: `app/api/cards/expert/route.ts`

**Step 1: Write the file**

This mirrors `/api/cards/research` but draws from `difficulty = 'extreme'` cards.
If no extreme cards exist yet, returns an empty array (Game.tsx falls back to freeplay).

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_real')
    .select('*')
    .eq('difficulty', 'extreme');

  if (error) return NextResponse.json([], { status: 200 });

  const rows = (data ?? []) as Record<string, unknown>[];
  const cards = rows.map((c) => ({
    id: c.card_id,
    type: c.type,
    difficulty: c.difficulty,
    isPhishing: c.is_phishing,
    from: c.from_address,
    subject: c.subject ?? undefined,
    body: c.body,
    clues: Array.isArray(c.clues) ? c.clues : [],
    highlights: Array.isArray(c.highlights) ? c.highlights : [],
    explanation: c.explanation,
    technique: c.technique ?? null,
    authStatus: c.auth_status ?? 'verified',
    replyTo: c.reply_to ?? undefined,
    attachmentName: c.attachment_name ?? undefined,
    sentAt: c.sent_at ?? undefined,
    cardSource: 'real',
    secondaryTechnique: c.secondary_technique ?? null,
    isGenaiSuspected: c.is_genai_suspected ?? null,
    genaiConfidence: c.genai_confidence ?? null,
    grammarQuality: c.grammar_quality ?? null,
    proseFluency: c.prose_fluency ?? null,
    personalizationLevel: c.personalization_level ?? null,
    contextualCoherence: c.contextual_coherence ?? null,
    datasetVersion: c.dataset_version ?? 'v1',
  }));

  return NextResponse.json(cards);
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/api/cards/expert/route.ts
git commit -m "feat: add GET /api/cards/expert for extreme difficulty deck"
```

---

## Task 10: Update /api/answers/route.ts — add 'expert' mode

**Files:**
- Modify: `app/api/answers/route.ts`

**Step 1: Add 'expert' to VALID_MODES**

Find the VALID_MODES line and update:
```typescript
// before:
const VALID_MODES = ['research', 'freeplay', 'daily', 'preview'] as const;
// after:
const VALID_MODES = ['research', 'freeplay', 'daily', 'preview', 'expert'] as const;
```

Expert mode answers are recorded the same as freeplay — no session dedup, no research-only verification.
The server-side correct/technique verification block only runs for `gameMode === 'research'`. Expert keeps the same.

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/api/answers/route.ts
git commit -m "feat: allow expert game_mode in answers route"
```

---

## Task 11: lib/usePlayer.ts — client auth hook

**Files:**
- Create: `lib/usePlayer.ts`

**Step 1: Write the file**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from './supabase-browser';
import type { PlayerProfile } from './types';

interface UsePlayerReturn {
  profile: PlayerProfile | null;
  loading: boolean;
  signedIn: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function usePlayer(): UsePlayerReturn {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/player');
      if (res.ok) setProfile(await res.json());
      else setProfile(null);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) refreshProfile().finally(() => setLoading(false));
      else setLoading(false);
    });

    // Listen for sign in / sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) refreshProfile();
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [refreshProfile]);

  async function signInWithEmail(email: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: error?.message ?? null };
    } catch {
      return { error: 'Failed to send magic link' };
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setProfile(null);
  }

  return {
    profile,
    loading,
    signedIn: !!profile,
    signInWithEmail,
    signOut,
    refreshProfile,
  };
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add lib/usePlayer.ts
git commit -m "feat: add usePlayer hook for auth state and profile"
```

---

## Task 12: AuthFlow component — magic link sign-in UI

**Files:**
- Create: `components/AuthFlow.tsx`

**Step 1: Write the file**

```typescript
'use client';

import { useState } from 'react';

interface AuthFlowProps {
  onSignIn: (email: string) => Promise<{ error: string | null }>;
  onCancel: () => void;
}

export function AuthFlow({ onSignIn, onCancel }: AuthFlowProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { setErrorMsg('Enter a valid email'); setState('error'); return; }
    setState('loading');
    const { error } = await onSignIn(email);
    if (error) { setErrorMsg(error); setState('error'); }
    else setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="term-border bg-[#060c06] px-3 py-6 text-center space-y-2">
        <div className="text-[#00ff41] font-mono font-bold text-sm glow">LINK_SENT</div>
        <div className="text-[#00aa28] text-xs font-mono">Check your inbox for {email}.</div>
        <div className="text-[#003a0e] text-[10px] font-mono">Click the link to activate your profile. This tab will update automatically.</div>
      </div>
    );
  }

  return (
    <div className="term-border bg-[#060c06]">
      <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
        <span className="text-[#00aa28] text-xs tracking-widest">CLAIM_PROFILE</span>
        <button onClick={onCancel} className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28]">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="px-3 py-3 space-y-3">
        <div className="text-[#003a0e] text-[10px] font-mono leading-relaxed">
          No password. We&apos;ll email you a sign-in link. Your XP persists across devices.
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="operator@terminal.sh"
          className="w-full bg-transparent border border-[rgba(0,255,65,0.25)] px-2 py-1.5 text-[#00ff41] font-mono text-xs placeholder:text-[#003a0e] focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
        />
        {state === 'error' && (
          <div className="text-[#ff3333] text-[10px] font-mono">{errorMsg}</div>
        )}
        <button
          type="submit"
          disabled={state === 'loading'}
          className="w-full py-2 term-border text-[#00ff41] font-mono font-bold text-xs tracking-widest hover:bg-[rgba(0,255,65,0.05)] disabled:opacity-40"
        >
          {state === 'loading' ? 'SENDING...' : '[ SEND LINK ]'}
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add components/AuthFlow.tsx
git commit -m "feat: add AuthFlow component for magic link sign-in"
```

---

## Task 13: LevelMeter component — XP progress bar

**Files:**
- Create: `components/LevelMeter.tsx`

**Step 1: Write the file**

```typescript
import { xpToNextLevel, MAX_LEVEL } from '@/lib/xp';

interface LevelMeterProps {
  xp: number;
  level: number;
  compact?: boolean; // true = 1 line for HUD use
}

export function LevelMeter({ xp, level, compact }: LevelMeterProps) {
  const { current, needed } = xpToNextLevel(xp);
  const pct = needed === 0 ? 100 : Math.round((current / needed) * 100);
  const isMax = level >= MAX_LEVEL;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-[#00aa28]">LVL {level}</span>
        <div className="w-16 h-0.5 bg-[#003a0e]">
          <div className="h-full bg-[#00aa28]" style={{ width: `${pct}%` }} />
        </div>
        {!isMax && <span className="text-[#003a0e]">{current}/{needed} XP</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-[#00aa28]">LEVEL {level}</span>
        <span className="text-[#003a0e]">{isMax ? 'MAX' : `${current} / ${needed} XP`}</span>
      </div>
      <div className="h-1 bg-[#003a0e] w-full">
        <div className="h-full bg-[#00ff41] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-[10px] font-mono text-[#003a0e]">{xp.toLocaleString()} XP total</div>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add components/LevelMeter.tsx
git commit -m "feat: add LevelMeter component for XP progress display"
```

---

## Task 14: Update StartScreen — player card, sign in, XP leaderboard tab

**Files:**
- Modify: `components/StartScreen.tsx`

**Step 1: Read the current file first**

Read `components/StartScreen.tsx` to see current structure.

**Step 2: Add player-related imports**

Add at the top:
```typescript
import { usePlayer } from '@/lib/usePlayer';
import { AuthFlow } from './AuthFlow';
import { LevelMeter } from './LevelMeter';
```

**Step 3: Add player state inside the component**

```typescript
const { profile, loading: playerLoading, signedIn, signInWithEmail, signOut } = usePlayer();
const [showAuthFlow, setShowAuthFlow] = useState(false);
const [xpLeaderboard, setXpLeaderboard] = useState<{ display_name: string | null; xp: number; level: number; research_graduated: boolean }[]>([]);
const [activeTab, setActiveTab] = useState<'score' | 'xp'>('score');
```

**Step 4: Fetch XP leaderboard on mount** (alongside existing score leaderboard fetch)

Add in the existing useEffect or a new one:
```typescript
fetch('/api/leaderboard/xp').then(r => r.ok ? r.json() : []).then(setXpLeaderboard).catch(() => {});
```

**Step 5: Add player card block above the [PLAY] button**

Before the `[ PLAY ]` button, add:
```tsx
{/* Player Profile Card */}
{!playerLoading && (
  <div className="term-border bg-[#060c06]">
    {signedIn && profile ? (
      <>
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[#00aa28] text-xs tracking-widest">{profile.displayName ?? 'OPERATOR'}</span>
          <button onClick={signOut} className="text-[#003a0e] text-[10px] font-mono hover:text-[#00aa28]">SIGN OUT</button>
        </div>
        <div className="px-3 py-2 space-y-2">
          <LevelMeter xp={profile.xp} level={profile.level} />
          {profile.researchGraduated && (
            <div className="text-[#ffaa00] text-[10px] font-mono">⬡ RESEARCH GRADUATED — EXPERT MODE UNLOCKED</div>
          )}
        </div>
      </>
    ) : showAuthFlow ? (
      <AuthFlow onSignIn={signInWithEmail} onCancel={() => setShowAuthFlow(false)} />
    ) : (
      <button
        onClick={() => setShowAuthFlow(true)}
        className="w-full px-3 py-2.5 text-left text-[#003a0e] text-[10px] font-mono hover:text-[#00aa28] hover:bg-[rgba(0,255,65,0.03)]"
      >
        [ CLAIM PROFILE ] — save XP across devices
      </button>
    )}
  </div>
)}
```

**Step 6: Add XP tab to leaderboard section**

In the leaderboard section, add a tab toggle between score and XP leaderboards.
Add the `activeTab` / `xpLeaderboard` tab UI alongside the existing leaderboard display.

Key XP leaderboard row format:
```tsx
<div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono">
  <span className="text-[#003a0e] w-4">{i + 1}.</span>
  <span className="text-[#00aa28] flex-1 truncate">{row.display_name ?? 'ANON'}</span>
  {row.research_graduated && <span className="text-[#ffaa00] text-[10px]">★</span>}
  <span className="text-[#003a0e] text-[10px]">LVL {row.level}</span>
  <span className="text-[#00ff41]">{row.xp.toLocaleString()} XP</span>
</div>
```

**Step 7: Add Expert Mode button (conditionally shown for graduated players)**

After the `[ PLAY ]` button, add:
```tsx
{signedIn && profile?.researchGraduated && (
  <button
    onClick={() => onStart('expert')}
    className="w-full py-4 term-border border-[rgba(255,170,0,0.4)] text-center text-[#ffaa00] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,170,0,0.05)]"
  >
    [ EXPERT MODE ]
  </button>
)}
```

**Step 8: Verify**

Run: `npx tsc --noEmit`

**Step 9: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "feat: add player card, auth flow, XP leaderboard tab, and expert mode button to StartScreen"
```

---

## Task 15: Update RoundSummary — show XP earned and level progress

**Files:**
- Modify: `components/RoundSummary.tsx`

**Step 1: Read the current file**

Read `components/RoundSummary.tsx` to see current structure.

**Step 2: Add imports**

```typescript
import { usePlayer } from '@/lib/usePlayer';
import { LevelMeter } from './LevelMeter';
import { getXpForRound } from '@/lib/xp';
```

**Step 3: Add XP state inside the component**

```typescript
const { profile, signedIn, refreshProfile } = usePlayer();
const [xpResult, setXpResult] = useState<{
  xpEarned: number; level: number; levelUp: boolean; graduated: boolean;
} | null>(null);
```

**Step 4: Call /api/player/xp once on mount (if signed in)**

```typescript
const correctCount = results.filter(r => r.correct).length;
const xpEarned = getXpForRound(correctCount, total, mode);

useEffect(() => {
  if (!signedIn) return;
  fetch('/api/player/xp', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xpEarned, score: totalScore, gameMode: mode, sessionCompleted: true }),
  })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data) { setXpResult(data); refreshProfile(); }
    })
    .catch(() => {});
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // fire once on mount
```

**Step 5: Add XP block above the score header (if signed in)**

```tsx
{signedIn && xpResult && (
  <div className="term-border bg-[#060c06] px-3 py-3 space-y-2">
    <div className="flex justify-between text-xs font-mono">
      <span className="text-[#00aa28]">XP EARNED</span>
      <span className="text-[#00ff41] font-bold glow">+{xpResult.xpEarned} XP</span>
    </div>
    {xpResult.levelUp && (
      <div className="text-[#ffaa00] text-xs font-mono glow text-center">LEVEL UP → {xpResult.level}</div>
    )}
    {xpResult.graduated && (
      <div className="term-border border-[rgba(255,170,0,0.4)] px-2 py-2 text-center">
        <div className="text-[#ffaa00] text-xs font-mono font-bold">RESEARCH GRADUATED</div>
        <div className="text-[#003a0e] text-[10px] font-mono mt-0.5">Expert Mode unlocked. You&apos;ve completed 10 research sessions.</div>
      </div>
    )}
    {profile && <LevelMeter xp={profile.xp} level={profile.level} />}
  </div>
)}
```

**Step 6: Verify**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```bash
git add components/RoundSummary.tsx
git commit -m "feat: award XP in RoundSummary with level up and graduation notifications"
```

---

## Task 16: Update Game.tsx — expert mode

**Files:**
- Modify: `components/Game.tsx`

**Step 1: Add expert to GamePhase union and startRound**

Add `'expert_unavailable'` to `GamePhase` type (same pattern as `research_unavailable`).

**Step 2: Handle `newMode === 'expert'` in `startRound`**

After the `research`/`preview` block, add:
```typescript
if (newMode === 'expert') {
  setPhase('loading' as GamePhase);
  fetch('/api/cards/expert')
    .then(r => r.json())
    .then((cards: Card[]) => {
      if (!cards.length) {
        // No extreme cards yet — fall back to freeplay silently
        setMode('freeplay');
        setDeck(getShuffledDeck(ROUND_SIZE));
        setPhase('playing');
        return;
      }
      const arr = [...cards];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setDeck(arr.slice(0, ROUND_SIZE));
      setPhase('playing');
    })
    .catch(() => setPhase('start'));
  return;
}
```

**Step 3: Expert mode answers bypass research session dedup check**

No changes needed — the answers route already only does session dedup for `gameMode === 'research'`. Expert answers record normally.

**Step 4: Verify**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add components/Game.tsx
git commit -m "feat: add expert mode card loading in Game.tsx"
```

---

## Task 17: Manual testing checklist

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test auth flow**
- Open localhost:3000
- Click "[ CLAIM PROFILE ]" → enter a real email → verify link-sent screen appears
- Check inbox → click magic link → verify redirect to / with profile loaded
- Verify display name can be set (if UI is added; otherwise skip)
- Sign out → verify profile clears

**Step 3: Test XP award**
- Sign in, play a full research round (10 cards)
- After summary, verify XP block shows +XP earned
- Verify level meter updates
- Check /api/player returns updated xp/level

**Step 4: Test graduation**
- Manually update `research_sessions_completed` to 9 in Supabase, then play one more research round
- Verify graduated notification appears in RoundSummary
- Verify Expert Mode button appears on StartScreen

**Step 5: Test expert mode (if extreme cards exist)**
- If no extreme cards: click Expert Mode → falls back to freeplay silently (no crash)
- If extreme cards exist: verify deck loads and answers are recorded with `game_mode = 'expert'`

**Step 6: Test XP leaderboard**
- Open StartScreen, switch to XP tab
- Verify signed-in player's score appears (after playing a round)

**Step 7: Commit any fixes found during testing**

```bash
git add -p
git commit -m "fix: manual testing fixes for player accounts feature"
```

---

## Final: push branch

```bash
git push origin feature/player-accounts
```

Then evaluate using `superpowers:finishing-a-development-branch` to decide merge/PR/keep.
