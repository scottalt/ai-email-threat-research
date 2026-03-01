# Research Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Retro Phish research platform skeleton — Supabase integration, AI preprocessing abstraction, admin review UI, research game mode, answer event logging, public analytics page, and weakness tracking — stopping before sample import.

**Architecture:** Five Supabase tables store the full research pipeline (cards_staging → cards_real → answers + sessions). A model-agnostic AI preprocessor (OpenAI default, Anthropic swappable) handles all staging preprocessing. Game.tsx grows a third mode (`research`) that fetches cards from Supabase instead of the static deck and logs every answer event. The `/admin` route provides a password-protected card review UI. The `/intel` route shows live public analytics.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Supabase (Postgres via @supabase/supabase-js), OpenAI SDK, Upstash Redis (existing leaderboard unchanged)

**Prerequisites:** Scott must create a Supabase project at supabase.com and set these env vars in `.env.local` and Vercel before any Supabase-dependent tasks can be verified at runtime:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD` (any string, used to protect /admin)

Code can be written and build-verified without credentials. Runtime verification requires them.

---

### Task 1: Install Supabase + create client

**Files:**
- Modify: `package.json` (add dependency)
- Create: `lib/supabase.ts`
- Create: `.env.local.example`

**Step 1: Install the package**

```bash
npm install @supabase/supabase-js
```

Expected: package added to node_modules, package.json updated.

**Step 2: Create `lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

function getUrl() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is not set');
  return url;
}

function getAnonKey() {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('SUPABASE_ANON_KEY is not set');
  return key;
}

function getServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return key;
}

// Read-only client for public data queries (API routes only — never browser)
export function getSupabaseClient() {
  return createClient(getUrl(), getAnonKey());
}

// Admin client for inserts and privileged reads (API routes only — never browser)
export function getSupabaseAdminClient() {
  return createClient(getUrl(), getServiceKey());
}
```

**Step 3: Create `.env.local.example`**

```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin UI
ADMIN_PASSWORD=choose-a-strong-password
```

**Step 4: Run build to verify**

```bash
npm run build
```

Expected: Clean compile. The env var checks only throw at runtime, not build time.

**Step 5: Commit**

```bash
git add lib/supabase.ts .env.local.example package.json package-lock.json
git commit -m "feat: add Supabase client utility"
```

---

### Task 2: Database schema SQL

**Files:**
- Create: `supabase/schema.sql`

**Step 1: Write the schema**

Create `supabase/schema.sql` with this exact content:

```sql
-- ============================================================
-- Retro Phish — Research Platform Schema
-- Run this in the Supabase SQL editor to initialise the DB.
-- ============================================================

-- cards_staging: raw imported emails + AI preprocessing results
CREATE TABLE cards_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_email_hash TEXT UNIQUE NOT NULL,
  import_batch_id UUID,
  source_corpus TEXT NOT NULL,
  raw_from TEXT,
  raw_subject TEXT,
  raw_body TEXT NOT NULL,
  email_headers_json JSONB,
  received_date TIMESTAMPTZ,
  has_html BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count SMALLINT DEFAULT 0,
  attachment_types TEXT[],
  link_count SMALLINT DEFAULT 0,
  links_json JSONB,
  language_detected TEXT DEFAULT 'en',
  inferred_type TEXT NOT NULL CHECK (inferred_type IN ('email', 'sms')),
  is_phishing BOOLEAN,
  -- AI preprocessing outputs
  processed_from TEXT,
  processed_subject TEXT,
  processed_body TEXT,
  sanitized_body TEXT,
  suggested_technique TEXT,
  suggested_secondary_technique TEXT,
  suggested_difficulty TEXT CHECK (suggested_difficulty IN ('easy', 'medium', 'hard')),
  suggested_highlights TEXT[],
  suggested_clues TEXT[],
  suggested_explanation TEXT,
  -- Linguistic quality scores 0-5
  grammar_quality SMALLINT CHECK (grammar_quality BETWEEN 0 AND 5),
  prose_fluency SMALLINT CHECK (prose_fluency BETWEEN 0 AND 5),
  personalization_level SMALLINT CHECK (personalization_level BETWEEN 0 AND 5),
  contextual_coherence SMALLINT CHECK (contextual_coherence BETWEEN 0 AND 5),
  -- GenAI classification
  genai_detector_score FLOAT CHECK (genai_detector_score BETWEEN 0 AND 1),
  is_genai_suspected BOOLEAN,
  genai_confidence TEXT CHECK (genai_confidence IN ('low', 'medium', 'high')),
  genai_ai_assessment TEXT CHECK (genai_ai_assessment IN ('low', 'medium', 'high')),
  genai_ai_reasoning TEXT,
  -- Content moderation
  content_flagged BOOLEAN DEFAULT FALSE,
  content_flag_reason TEXT,
  -- AI metadata
  ai_provider TEXT,
  ai_model TEXT,
  ai_preprocessing_version TEXT,
  ai_processed_at TIMESTAMPTZ,
  -- Review state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_review')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_staging_status ON cards_staging(status);
CREATE INDEX idx_cards_staging_batch ON cards_staging(import_batch_id);
CREATE INDEX idx_cards_staging_hash ON cards_staging(raw_email_hash);

-- cards_real: curated live dataset
CREATE TABLE cards_real (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id UUID REFERENCES cards_staging(id),
  card_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  is_phishing BOOLEAN NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  from_address TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  body_truncated BOOLEAN DEFAULT FALSE,
  word_count INT,
  char_count INT,
  link_count_in_display SMALLINT DEFAULT 0,
  technique TEXT,
  secondary_technique TEXT,
  -- Linguistic quality scores 0-5
  grammar_quality SMALLINT CHECK (grammar_quality BETWEEN 0 AND 5),
  prose_fluency SMALLINT CHECK (prose_fluency BETWEEN 0 AND 5),
  personalization_level SMALLINT CHECK (personalization_level BETWEEN 0 AND 5),
  contextual_coherence SMALLINT CHECK (contextual_coherence BETWEEN 0 AND 5),
  -- Computed readability metrics
  flesch_kincaid_score FLOAT,
  avg_sentence_length FLOAT,
  sentence_length_variance FLOAT,
  -- GenAI classification
  genai_detector_score FLOAT CHECK (genai_detector_score BETWEEN 0 AND 1),
  is_genai_suspected BOOLEAN,
  genai_confidence TEXT CHECK (genai_confidence IN ('low', 'medium', 'high')),
  genai_ai_reasoning TEXT,
  genai_reviewer_reasoning TEXT,
  -- Curation metadata
  is_verbatim BOOLEAN DEFAULT FALSE,
  source_corpus TEXT NOT NULL,
  highlights TEXT[],
  clues TEXT[],
  explanation TEXT,
  review_notes TEXT,
  review_time_ms INT,
  ai_model TEXT,
  ai_preprocessing_version TEXT,
  dataset_version TEXT DEFAULT 'v1',
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_real_card_id ON cards_real(card_id);
CREATE INDEX idx_cards_real_phishing ON cards_real(is_phishing);
CREATE INDEX idx_cards_real_technique ON cards_real(technique);
CREATE INDEX idx_cards_real_dataset ON cards_real(dataset_version);
CREATE INDEX idx_cards_real_genai ON cards_real(is_genai_suspected);

-- answers: every research mode answer event
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  card_id TEXT NOT NULL,
  card_source TEXT NOT NULL CHECK (card_source IN ('generated', 'real')),
  is_phishing BOOLEAN NOT NULL,
  technique TEXT,
  secondary_technique TEXT,
  is_genai_suspected BOOLEAN,
  genai_confidence TEXT CHECK (genai_confidence IN ('low', 'medium', 'high')),
  -- Denormalised linguistic scores for fast analytical queries
  grammar_quality SMALLINT,
  prose_fluency SMALLINT,
  personalization_level SMALLINT,
  contextual_coherence SMALLINT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  user_answer TEXT NOT NULL CHECK (user_answer IN ('phishing', 'legit')),
  correct BOOLEAN NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('guessing', 'likely', 'certain')),
  -- Timing (milliseconds)
  time_from_render_ms INT,
  time_from_confidence_ms INT,
  confidence_selection_time_ms INT,
  -- Behaviour
  scroll_depth_pct SMALLINT CHECK (scroll_depth_pct BETWEEN 0 AND 100),
  answer_method TEXT CHECK (answer_method IN ('swipe', 'button')),
  answer_ordinal SMALLINT CHECK (answer_ordinal BETWEEN 1 AND 10),
  streak_at_answer_time SMALLINT,
  correct_count_at_time SMALLINT,
  -- Context
  game_mode TEXT NOT NULL CHECK (game_mode IN ('research', 'training', 'freeplay', 'daily')),
  is_daily_challenge BOOLEAN DEFAULT FALSE,
  dataset_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_answers_session ON answers(session_id);
CREATE INDEX idx_answers_created ON answers(created_at);
CREATE INDEX idx_answers_card ON answers(card_id);
CREATE INDEX idx_answers_technique ON answers(technique);
CREATE INDEX idx_answers_genai ON answers(is_genai_suspected);
CREATE INDEX idx_answers_correct ON answers(correct);

-- sessions: one row per game played
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('research', 'training', 'freeplay', 'daily')),
  is_daily_challenge BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cards_answered SMALLINT DEFAULT 0,
  final_score INT,
  final_rank TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  viewport_width SMALLINT,
  viewport_height SMALLINT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- import_batches: tracks each corpus import run
CREATE TABLE import_batches (
  batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_corpus TEXT NOT NULL,
  import_date TIMESTAMPTZ DEFAULT NOW(),
  raw_count INT DEFAULT 0,
  processed_count INT DEFAULT 0,
  approved_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  notes TEXT
);

-- dataset_versions: version registry
CREATE TABLE dataset_versions (
  version TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ,
  total_cards INT DEFAULT 0,
  phishing_count INT DEFAULT 0,
  legit_count INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO dataset_versions (version, description)
VALUES ('v1', 'Initial dataset — GenAI era phishing, post-2023 samples, 600 phishing / 400 legitimate');
```

**Step 2: Note — run this manually**

This file is not executed automatically. Once Scott has Supabase credentials, open the Supabase dashboard → SQL Editor → paste and run this file.

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase research platform schema"
```

---

### Task 3: Extend types for research mode

**Files:**
- Modify: `lib/types.ts`

**Step 1: Read the file**

Read `lib/types.ts` to confirm current contents.

**Step 2: Add research to GameMode and add ResearchCard type**

Find `export type GameMode`:
```typescript
export type GameMode = 'freeplay' | 'daily';
```

Replace with:
```typescript
export type GameMode = 'freeplay' | 'daily' | 'research';
```

Then add at the end of the file:

```typescript
// Research mode card — extends Card with research metadata from cards_real
export interface ResearchCard extends Card {
  cardSource: 'real';
  technique: string | null;
  secondaryTechnique: string | null;
  isGenaiSuspected: boolean | null;
  genaiConfidence: 'low' | 'medium' | 'high' | null;
  grammarQuality: number | null;
  proseFluency: number | null;
  personalizationLevel: number | null;
  contextualCoherence: number | null;
  datasetVersion: string;
}

// Answer event payload sent to POST /api/answers
export interface AnswerEvent {
  sessionId: string;
  cardId: string;
  cardSource: 'generated' | 'real';
  isPhishing: boolean;
  technique: string | null;
  secondaryTechnique: string | null;
  isGenaiSuspected: boolean | null;
  genaiConfidence: string | null;
  grammarQuality: number | null;
  proseFluency: number | null;
  personalizationLevel: number | null;
  contextualCoherence: number | null;
  difficulty: string;
  type: string;
  userAnswer: string;
  correct: boolean;
  confidence: string;
  timeFromRenderMs: number | null;
  timeFromConfidenceMs: number | null;
  confidenceSelectionTimeMs: number | null;
  scrollDepthPct: number;
  answerMethod: 'swipe' | 'button';
  answerOrdinal: number;
  streakAtAnswerTime: number;
  correctCountAtTime: number;
  gameMode: string;
  isDailyChallenge: boolean;
  datasetVersion: string | null;
}

// Session payload sent alongside each answer event
export interface SessionPayload {
  sessionId: string;
  gameMode: string;
  isDailyChallenge: boolean;
  startedAt: string;
  completedAt: string | null;
  cardsAnswered: number;
  finalScore: number | null;
  finalRank: string | null;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  viewportWidth: number;
  viewportHeight: number;
  referrer: string;
}
```

**Step 3: Run build**

```bash
npm run build
```

Expected: Clean compile.

**Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: extend types for research mode and answer events"
```

---

### Task 4: AI preprocessor abstraction

**Files:**
- Create: `lib/ai-preprocessor.ts`
- Create: `lib/preprocessors/openai.ts`
- Create: `lib/preprocessors/anthropic.ts`

**Step 1: Create `lib/ai-preprocessor.ts`**

```typescript
export interface RawEmailInput {
  rawFrom: string;
  rawSubject: string | null;
  rawBody: string;
  isPhishing: boolean;
  type: 'email' | 'sms';
}

export interface PreprocessResult {
  processedFrom: string;
  processedSubject: string | null;
  processedBody: string;
  sanitizedBody: string | null;
  suggestedTechnique: string;
  suggestedSecondaryTechnique: string | null;
  suggestedDifficulty: 'easy' | 'medium' | 'hard';
  suggestedHighlights: string[];
  suggestedClues: string[];
  suggestedExplanation: string;
  grammarQuality: number;
  proseFluency: number;
  personalizationLevel: number;
  contextualCoherence: number;
  isGenaiSuspected: boolean;
  genaiConfidence: 'low' | 'medium' | 'high';
  genaiAiAssessment: 'low' | 'medium' | 'high';
  genaiAiReasoning: string;
  contentFlagged: boolean;
  contentFlagReason: string | null;
}

export interface AIPreprocessor {
  process(input: RawEmailInput): Promise<PreprocessResult>;
}

export const PREPROCESSING_VERSION = '1.0';

export const SYSTEM_PROMPT = `You are a security researcher processing phishing and legitimate email samples for a research dataset. Your output must be valid JSON only — no markdown, no explanation outside the JSON object.

CRITICAL: Your FIRST action is to strip all PII from the content before any analysis. Replace:
- Real personal names with [RECIPIENT NAME] or [SENDER NAME]
- Email addresses in body text (not the from/to headers) with [EMAIL]
- Phone numbers with [PHONE]
- Account numbers, order numbers, reference numbers with [ACCOUNT NUMBER]
- Physical addresses with [ADDRESS]
- Do NOT strip domain names — they are important phishing signals

After PII stripping, analyse the email and return this JSON structure:
{
  "processedFrom": "cleaned sender (keep domain, replace personal name if present)",
  "processedSubject": "cleaned subject or null if none",
  "processedBody": "PII-stripped, cleaned email body — plain text only, no HTML tags",
  "sanitizedBody": "rewritten body if inappropriate content detected, otherwise null",
  "suggestedTechnique": "primary technique from: urgency|domain-spoofing|authority-impersonation|grammar-tells|hyper-personalization|fluent-prose|reward-prize|it-helpdesk|credential-harvest|invoice-fraud|pretexting|quishing|callback-phishing|multi-stage",
  "suggestedSecondaryTechnique": "secondary technique or null",
  "suggestedDifficulty": "easy|medium|hard",
  "suggestedHighlights": ["exact phrase to highlight in red flag review"],
  "suggestedClues": ["analyst clue explaining a red flag"],
  "suggestedExplanation": "one clear paragraph explaining why this is phishing or legitimate",
  "grammarQuality": 0,
  "proseFluency": 0,
  "personalizationLevel": 0,
  "contextualCoherence": 0,
  "isGenaiSuspected": false,
  "genaiConfidence": "low",
  "genaiAiAssessment": "low",
  "genaiAiReasoning": "explanation of GenAI assessment",
  "contentFlagged": false,
  "contentFlagReason": null
}

Scoring (0–5):
- grammarQuality: 0=incomprehensible, 1=many errors, 2=some errors, 3=minor errors, 4=mostly correct, 5=perfect
- proseFluency: 0=incoherent, 1=awkward, 2=stilted, 3=acceptable, 4=natural, 5=polished
- personalizationLevel: 0=generic template, 1=minimal, 2=some context, 3=moderate, 4=highly personalised, 5=hyper-personalised
- contextualCoherence: 0=nonsensical, 1=confusing, 2=partial, 3=mostly coherent, 4=coherent, 5=highly contextually aware

isGenaiSuspected: true if the email exhibits AI generation characteristics — high fluency, perfect grammar, unnatural polish, contextual awareness without cultural markers, overly formal phrasing.
contentFlagged: true if the email contains explicit sexual content, extreme violence, hate speech, or content that would be inappropriate to display in a public game.`;

export function getUserPrompt(input: RawEmailInput): string {
  return `Process this ${input.isPhishing ? 'phishing' : 'legitimate'} ${input.type}:

FROM: ${input.rawFrom}
${input.rawSubject ? `SUBJECT: ${input.rawSubject}\n` : ''}BODY:
${input.rawBody}`;
}

export function getPreprocessor(): AIPreprocessor {
  const provider = process.env.AI_PROVIDER ?? 'openai';
  if (provider === 'anthropic') {
    // Dynamic import to avoid loading Anthropic SDK if not needed
    const { AnthropicPreprocessor } = require('./preprocessors/anthropic');
    return new AnthropicPreprocessor();
  }
  const { OpenAIPreprocessor } = require('./preprocessors/openai');
  return new OpenAIPreprocessor();
}
```

**Step 2: Create `lib/preprocessors/openai.ts`**

```typescript
import type { AIPreprocessor, RawEmailInput, PreprocessResult } from '../ai-preprocessor';
import { SYSTEM_PROMPT, getUserPrompt, PREPROCESSING_VERSION } from '../ai-preprocessor';
import OpenAI from 'openai';

export class OpenAIPreprocessor implements AIPreprocessor {
  private client: OpenAI;
  readonly modelId = 'gpt-4o';
  readonly version = PREPROCESSING_VERSION;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async process(input: RawEmailInput): Promise<PreprocessResult> {
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: getUserPrompt(input) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');

    return JSON.parse(content) as PreprocessResult;
  }
}
```

**Step 3: Create `lib/preprocessors/anthropic.ts`**

```typescript
import type { AIPreprocessor, RawEmailInput, PreprocessResult } from '../ai-preprocessor';
import { SYSTEM_PROMPT, getUserPrompt, PREPROCESSING_VERSION } from '../ai-preprocessor';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicPreprocessor implements AIPreprocessor {
  private client: Anthropic;
  readonly modelId = 'claude-opus-4-6';
  readonly version = PREPROCESSING_VERSION;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async process(input: RawEmailInput): Promise<PreprocessResult> {
    const message = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: getUserPrompt(input) }],
    });

    const block = message.content[0];
    if (block.type !== 'text') throw new Error('Anthropic returned non-text response');

    // Strip any markdown code fences if present
    const json = block.text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(json) as PreprocessResult;
  }
}
```

**Step 4: Install OpenAI SDK (Anthropic SDK optional)**

```bash
npm install openai
```

Add `OPENAI_API_KEY` to `.env.local.example`.

**Step 5: Run build**

```bash
npm run build
```

Expected: Clean compile.

**Step 6: Commit**

```bash
git add lib/ai-preprocessor.ts lib/preprocessors/openai.ts lib/preprocessors/anthropic.ts .env.local.example package.json package-lock.json
git commit -m "feat: add model-agnostic AI preprocessor abstraction"
```

---

### Task 5: Admin authentication middleware

**Files:**
- Create: `middleware.ts` (project root)
- Create: `app/admin/login/page.tsx`
- Create: `app/api/admin/login/route.ts`

**Step 1: Create `middleware.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin routes (not /api/admin/login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get('admin_session')?.value;
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected || token !== expected) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

**Step 2: Create `app/api/admin/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  });
  return res;
}
```

**Step 3: Create `app/admin/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/admin');
    } else {
      setError('ACCESS DENIED.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060c06] flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2">
            <span className="text-[#00aa28] text-xs tracking-widest">ADMIN_TERMINAL</span>
          </div>
          <form onSubmit={handleSubmit} className="px-3 py-4 space-y-3">
            <div className="text-[#00aa28] text-xs font-mono">ENTER ADMIN PASSWORD:</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.3)] text-[#00ff41] font-mono text-xs px-2 py-2 focus:outline-none focus:border-[rgba(0,255,65,0.7)]"
              autoFocus
            />
            {error && <div className="text-[#ff3333] text-xs font-mono">{error}</div>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2 term-border text-[#00ff41] font-mono text-xs tracking-widest hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 transition-all"
            >
              {loading ? 'AUTHENTICATING...' : '[ AUTHENTICATE ]'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run build**

```bash
npm run build
```

Expected: Clean compile.

**Step 5: Commit**

```bash
git add middleware.ts app/admin/login/page.tsx app/api/admin/login/route.ts
git commit -m "feat: add admin authentication middleware and login page"
```

---

### Task 6: Admin dashboard page

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/api/admin/stats/route.ts`

**Step 1: Create `app/api/admin/stats/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();

    const [pending, approved, rejected, needsReview, real] = await Promise.all([
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'needs_review'),
      supabase.from('cards_real').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      needsReview: needsReview.count ?? 0,
      liveCards: real.count ?? 0,
      targetCards: 1000,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

**Step 2: Create `app/admin/page.tsx`**

```tsx
import Link from 'next/link';

async function getStats() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/admin/stats`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const stats = await getStats();
  const progress = stats ? Math.round((stats.liveCards / stats.targetCards) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-4 mt-8">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">ADMIN_DASHBOARD</span>
            <Link href="/" className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28]">← BACK</Link>
          </div>
          <div className="px-3 py-4 space-y-4">
            {stats ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'PENDING', value: stats.pending, color: 'text-[#ffaa00]' },
                    { label: 'APPROVED', value: stats.approved, color: 'text-[#00ff41]' },
                    { label: 'REJECTED', value: stats.rejected, color: 'text-[#ff3333]' },
                    { label: 'NEEDS REVIEW', value: stats.needsReview, color: 'text-[#ffaa00]' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="term-border px-3 py-2 text-center">
                      <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
                      <div className="text-[10px] font-mono text-[#003a0e] mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#00aa28]">DATASET v1 PROGRESS</span>
                    <span className="text-[#00ff41]">{stats.liveCards} / {stats.targetCards}</span>
                  </div>
                  <div className="w-full h-2 bg-[#003a0e]">
                    <div
                      className="h-full bg-[#00ff41] transition-all"
                      style={{ width: `${progress}%`, boxShadow: '0 0 6px rgba(0,255,65,0.8)' }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-[#003a0e] text-right">{progress}% COMPLETE</div>
                </div>
              </>
            ) : (
              <div className="text-[#00aa28] text-xs font-mono text-center py-4">
                SUPABASE NOT CONNECTED — set env vars to enable
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Link
            href="/admin/review"
            className="block w-full py-3 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm text-center hover:bg-[rgba(0,255,65,0.08)] transition-all glow"
          >
            [ REVIEW QUEUE ]
          </Link>
          <Link
            href="/api/admin/export?format=json"
            className="block w-full py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
          >
            [ EXPORT DATASET (JSON) ]
          </Link>
          <Link
            href="/api/admin/export?format=csv"
            className="block w-full py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
          >
            [ EXPORT DATASET (CSV) ]
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Run build**

```bash
npm run build
```

Expected: Clean compile.

**Step 4: Commit**

```bash
git add app/admin/page.tsx app/api/admin/stats/route.ts
git commit -m "feat: add admin dashboard page"
```

---

### Task 7: Admin review page

**Files:**
- Create: `app/admin/review/page.tsx`
- Create: `app/api/admin/review/route.ts`

**Step 1: Create `app/api/admin/review/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET — fetch next pending card for review
export async function GET() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_staging')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) return NextResponse.json({ card: null });
  return NextResponse.json({ card: data });
}

// POST — approve, reject, or mark needs_review
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const body = await req.json();
  const { action, stagingId, reviewedFields } = body;

  if (!['approved', 'rejected', 'needs_review'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  // Update staging status
  const { error: stagingError } = await supabase
    .from('cards_staging')
    .update({ status: action, reviewed_at: new Date().toISOString() })
    .eq('id', stagingId);

  if (stagingError) return NextResponse.json({ error: stagingError.message }, { status: 500 });

  // If approved, insert into cards_real
  if (action === 'approved' && reviewedFields) {
    const wordCount = reviewedFields.body ? reviewedFields.body.trim().split(/\s+/).length : 0;
    const charCount = reviewedFields.body ? reviewedFields.body.length : 0;

    const { error: realError } = await supabase.from('cards_real').insert({
      staging_id: stagingId,
      card_id: `real-${reviewedFields.is_phishing ? 'p' : 'l'}-${Date.now()}`,
      type: reviewedFields.inferred_type,
      is_phishing: reviewedFields.is_phishing,
      difficulty: reviewedFields.suggested_difficulty,
      from_address: reviewedFields.processed_from,
      subject: reviewedFields.processed_subject,
      body: reviewedFields.processed_body,
      word_count: wordCount,
      char_count: charCount,
      technique: reviewedFields.suggested_technique,
      secondary_technique: reviewedFields.suggested_secondary_technique,
      grammar_quality: reviewedFields.grammar_quality,
      prose_fluency: reviewedFields.prose_fluency,
      personalization_level: reviewedFields.personalization_level,
      contextual_coherence: reviewedFields.contextual_coherence,
      genai_detector_score: reviewedFields.genai_detector_score,
      is_genai_suspected: reviewedFields.is_genai_suspected,
      genai_confidence: reviewedFields.genai_confidence,
      genai_ai_reasoning: reviewedFields.genai_ai_reasoning,
      genai_reviewer_reasoning: reviewedFields.genai_reviewer_reasoning ?? null,
      is_verbatim: reviewedFields.is_verbatim ?? false,
      source_corpus: reviewedFields.source_corpus,
      highlights: reviewedFields.suggested_highlights,
      clues: reviewedFields.suggested_clues,
      explanation: reviewedFields.suggested_explanation,
      review_notes: reviewedFields.review_notes ?? null,
      review_time_ms: reviewedFields.review_time_ms ?? null,
      ai_model: reviewedFields.ai_model,
      ai_preprocessing_version: reviewedFields.ai_preprocessing_version,
    });

    if (realError) return NextResponse.json({ error: realError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

**Step 2: Create `app/admin/review/page.tsx`**

```tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface StagingCard {
  id: string;
  raw_from: string;
  raw_subject: string | null;
  raw_body: string;
  source_corpus: string;
  inferred_type: string;
  is_phishing: boolean | null;
  processed_from: string | null;
  processed_subject: string | null;
  processed_body: string | null;
  suggested_technique: string | null;
  suggested_secondary_technique: string | null;
  suggested_difficulty: string | null;
  suggested_highlights: string[] | null;
  suggested_clues: string[] | null;
  suggested_explanation: string | null;
  grammar_quality: number | null;
  prose_fluency: number | null;
  personalization_level: number | null;
  contextual_coherence: number | null;
  genai_detector_score: number | null;
  is_genai_suspected: boolean | null;
  genai_confidence: string | null;
  genai_ai_reasoning: string | null;
  ai_model: string | null;
  ai_preprocessing_version: string | null;
  content_flagged: boolean;
  content_flag_reason: string | null;
}

export default function ReviewPage() {
  const [card, setCard] = useState<StagingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const cardLoadTime = useRef<number>(Date.now());

  // Editable fields — pre-filled from AI suggestions
  const [processedFrom, setProcessedFrom] = useState('');
  const [processedSubject, setProcessedSubject] = useState('');
  const [processedBody, setProcessedBody] = useState('');
  const [technique, setTechnique] = useState('');
  const [secondaryTechnique, setSecondaryTechnique] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [isPhishing, setIsPhishing] = useState(true);
  const [isVerbatim, setIsVerbatim] = useState(false);
  const [isGenai, setIsGenai] = useState(false);
  const [genaiConfidence, setGenaiConfidence] = useState('low');
  const [genaiReviewerReasoning, setGenaiReviewerReasoning] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch('/api/admin/review');
      const { card: next } = await res.json();
      if (!next) { setDone(true); setCard(null); } else {
        setCard(next);
        setProcessedFrom(next.processed_from ?? next.raw_from ?? '');
        setProcessedSubject(next.processed_subject ?? next.raw_subject ?? '');
        setProcessedBody(next.processed_body ?? next.raw_body ?? '');
        setTechnique(next.suggested_technique ?? '');
        setSecondaryTechnique(next.suggested_secondary_technique ?? '');
        setDifficulty(next.suggested_difficulty ?? 'medium');
        setIsPhishing(next.is_phishing ?? true);
        setIsVerbatim(false);
        setIsGenai(next.is_genai_suspected ?? false);
        setGenaiConfidence(next.genai_confidence ?? 'low');
        setGenaiReviewerReasoning('');
        setReviewNotes('');
        cardLoadTime.current = Date.now();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'a') handleAction('approved');
      if (e.key === 'r') handleAction('rejected');
      if (e.key === 'n') handleAction('needs_review');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function handleAction(action: 'approved' | 'rejected' | 'needs_review') {
    if (!card || submitting) return;
    setSubmitting(true);
    const reviewTimeMs = Date.now() - cardLoadTime.current;

    await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        stagingId: card.id,
        reviewedFields: action === 'approved' ? {
          inferred_type: card.inferred_type,
          is_phishing: isPhishing,
          processed_from: processedFrom,
          processed_subject: processedSubject || null,
          processed_body: processedBody,
          suggested_technique: technique,
          suggested_secondary_technique: secondaryTechnique || null,
          suggested_difficulty: difficulty,
          suggested_highlights: card.suggested_highlights ?? [],
          suggested_clues: card.suggested_clues ?? [],
          suggested_explanation: card.suggested_explanation ?? '',
          grammar_quality: card.grammar_quality,
          prose_fluency: card.prose_fluency,
          personalization_level: card.personalization_level,
          contextual_coherence: card.contextual_coherence,
          genai_detector_score: card.genai_detector_score,
          is_genai_suspected: isGenai,
          genai_confidence: genaiConfidence,
          genai_ai_reasoning: card.genai_ai_reasoning,
          genai_reviewer_reasoning: genaiReviewerReasoning || null,
          is_verbatim: isVerbatim,
          source_corpus: card.source_corpus,
          review_notes: reviewNotes || null,
          review_time_ms: reviewTimeMs,
          ai_model: card.ai_model,
          ai_preprocessing_version: card.ai_preprocessing_version,
        } : null,
      }),
    });

    setSubmitting(false);
    fetchNext();
  }

  const TECHNIQUES = [
    'urgency', 'domain-spoofing', 'authority-impersonation', 'grammar-tells',
    'hyper-personalization', 'fluent-prose', 'reward-prize', 'it-helpdesk',
    'credential-harvest', 'invoice-fraud', 'pretexting', 'quishing',
    'callback-phishing', 'multi-stage',
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
      <span className="text-[#00aa28] font-mono text-xs">LOADING...</span>
    </div>
  );

  if (done) return (
    <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="text-[#00ff41] font-mono text-sm glow">QUEUE EMPTY</div>
        <div className="text-[#00aa28] font-mono text-xs">No pending cards to review.</div>
      </div>
    </div>
  );

  if (!card) return null;

  return (
    <div className="min-h-screen bg-[#060c06] p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#00aa28] tracking-widest">REVIEW_QUEUE</span>
          <span className="text-[#003a0e]">A=approve · R=reject · N=needs_review</span>
        </div>

        {card.content_flagged && (
          <div className="term-border border-[rgba(255,51,51,0.5)] px-3 py-2 text-xs font-mono text-[#ff3333]">
            ⚠ CONTENT FLAGGED: {card.content_flag_reason}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Left: Raw */}
          <div className="term-border bg-[#060c06] space-y-0">
            <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
              <span className="text-[#003a0e] text-xs tracking-widest">RAW_INPUT · {card.source_corpus}</span>
            </div>
            <div className="px-3 py-2 text-xs font-mono space-y-1">
              <div><span className="text-[#003a0e]">FROM:</span> <span className="text-[#00aa28]">{card.raw_from}</span></div>
              {card.raw_subject && <div><span className="text-[#003a0e]">SUBJ:</span> <span className="text-[#00aa28]">{card.raw_subject}</span></div>}
            </div>
            <div className="px-3 pb-3 text-xs text-[#003a0e] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
              {card.raw_body}
            </div>
          </div>

          {/* Right: Processed (editable) */}
          <div className="term-border bg-[#060c06]">
            <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
              <span className="text-[#00aa28] text-xs tracking-widest">AI_PROCESSED · EDITABLE</span>
            </div>
            <div className="px-3 py-2 space-y-2">
              <input value={processedFrom} onChange={(e) => setProcessedFrom(e.target.value)}
                className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
                placeholder="FROM" />
              <input value={processedSubject} onChange={(e) => setProcessedSubject(e.target.value)}
                className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
                placeholder="SUBJECT (optional)" />
              <textarea value={processedBody} onChange={(e) => setProcessedBody(e.target.value)}
                rows={6}
                className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Classification fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="term-border bg-[#060c06] px-3 py-3 space-y-3">
            <div className="text-[#00aa28] text-xs font-mono tracking-widest">CLASSIFICATION</div>

            <div className="flex gap-2">
              {['phishing', 'legit'].map((v) => (
                <button key={v} onClick={() => setIsPhishing(v === 'phishing')}
                  className={`flex-1 py-1.5 text-xs font-mono border transition-all ${
                    (v === 'phishing') === isPhishing
                      ? v === 'phishing' ? 'text-[#ff3333] border-[rgba(255,51,51,0.6)] bg-[rgba(255,51,51,0.08)]' : 'text-[#00ff41] border-[rgba(0,255,65,0.6)] bg-[rgba(0,255,65,0.08)]'
                      : 'text-[#003a0e] border-[rgba(0,255,65,0.15)]'
                  }`}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>

            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
              <option value="easy">EASY</option>
              <option value="medium">MEDIUM</option>
              <option value="hard">HARD</option>
            </select>

            <select value={technique} onChange={(e) => setTechnique(e.target.value)}
              className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
              <option value="">-- PRIMARY TECHNIQUE --</option>
              {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={secondaryTechnique} onChange={(e) => setSecondaryTechnique(e.target.value)}
              className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
              <option value="">-- SECONDARY TECHNIQUE (optional) --</option>
              {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <div className="flex gap-4 text-xs font-mono">
              <label className="flex items-center gap-2 text-[#00aa28] cursor-pointer">
                <input type="checkbox" checked={isVerbatim} onChange={(e) => setIsVerbatim(e.target.checked)} className="accent-[#00ff41]" />
                VERBATIM
              </label>
            </div>
          </div>

          <div className="term-border bg-[#060c06] px-3 py-3 space-y-3">
            <div className="text-[#00aa28] text-xs font-mono tracking-widest">GENAI ASSESSMENT</div>

            {card.genai_detector_score !== null && (
              <div className="text-xs font-mono">
                <span className="text-[#003a0e]">DETECTOR SCORE: </span>
                <span className="text-[#ffaa00]">{(card.genai_detector_score * 100).toFixed(1)}%</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                { label: 'GRAMMAR', value: card.grammar_quality },
                { label: 'FLUENCY', value: card.prose_fluency },
                { label: 'PERSONAL', value: card.personalization_level },
                { label: 'COHERENCE', value: card.contextual_coherence },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#003a0e]">{label}:</span>
                  <span className="text-[#00aa28]">{value ?? '—'}/5</span>
                </div>
              ))}
            </div>

            {card.genai_ai_reasoning && (
              <div className="text-[10px] font-mono text-[#003a0e] leading-relaxed">
                {card.genai_ai_reasoning}
              </div>
            )}

            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-2 text-xs font-mono text-[#00aa28] cursor-pointer">
                <input type="checkbox" checked={isGenai} onChange={(e) => setIsGenai(e.target.checked)} className="accent-[#00ff41]" />
                GENAI SUSPECTED
              </label>
              <select value={genaiConfidence} onChange={(e) => setGenaiConfidence(e.target.value)}
                className="flex-1 bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-1 py-1 focus:outline-none">
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
              </select>
            </div>

            <textarea value={genaiReviewerReasoning} onChange={(e) => setGenaiReviewerReasoning(e.target.value)}
              placeholder="Reviewer GenAI reasoning (optional)"
              rows={2}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.15)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none resize-none placeholder:text-[#003a0e]"
            />

            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Review notes (optional)"
              rows={2}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.15)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none resize-none placeholder:text-[#003a0e]"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={() => handleAction('approved')} disabled={submitting}
            className="flex-1 py-3 border border-[rgba(0,255,65,0.5)] text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 transition-all">
            [A] APPROVE
          </button>
          <button onClick={() => handleAction('needs_review')} disabled={submitting}
            className="flex-1 py-3 border border-[rgba(255,170,0,0.5)] text-[#ffaa00] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,170,0,0.08)] disabled:opacity-30 transition-all">
            [N] NEEDS REVIEW
          </button>
          <button onClick={() => handleAction('rejected')} disabled={submitting}
            className="flex-1 py-3 border border-[rgba(255,51,51,0.5)] text-[#ff3333] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,51,51,0.08)] disabled:opacity-30 transition-all">
            [R] REJECT
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Run build**

```bash
npm run build
```

Expected: Clean compile.

**Step 4: Commit**

```bash
git add app/admin/review/page.tsx app/api/admin/review/route.ts
git commit -m "feat: add admin review page for card curation"
```

---

### Task 8: Admin export route

**Files:**
- Create: `app/api/admin/export/route.ts`

**Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format') ?? 'json';
  const version = req.nextUrl.searchParams.get('version') ?? 'v1';

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_real')
    .select('*')
    .eq('dataset_version', version)
    .order('approved_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (format === 'csv') {
    if (!data || data.length === 0) return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) =>
      Object.values(row).map((v) =>
        v === null ? '' : typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
      ).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="retro-phish-dataset-${version}.csv"`,
      },
    });
  }

  return NextResponse.json(data, {
    headers: {
      'Content-Disposition': `attachment; filename="retro-phish-dataset-${version}.json"`,
    },
  });
}
```

**Step 2: Run build + commit**

```bash
npm run build
git add app/api/admin/export/route.ts
git commit -m "feat: add admin dataset export route (JSON + CSV)"
```

---

### Task 9: Research cards API route

**Files:**
- Create: `app/api/cards/research/route.ts`

**Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { Card } from '@/lib/types';

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('cards_real')
      .select('*')
      .eq('dataset_version', 'v1')
      .order('approved_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json([]);

    // Map Supabase rows to the Card interface the game expects,
    // with research metadata attached
    const cards: (Card & Record<string, unknown>)[] = data.map((row) => ({
      id: row.card_id,
      type: row.type,
      isPhishing: row.is_phishing,
      difficulty: row.difficulty,
      from: row.from_address,
      subject: row.subject ?? undefined,
      body: row.body,
      clues: row.clues ?? [],
      explanation: row.explanation ?? '',
      highlights: row.highlights ?? [],
      // Research metadata
      cardSource: 'real' as const,
      technique: row.technique,
      secondaryTechnique: row.secondary_technique,
      isGenaiSuspected: row.is_genai_suspected,
      genaiConfidence: row.genai_confidence,
      grammarQuality: row.grammar_quality,
      proseFluency: row.prose_fluency,
      personalizationLevel: row.personalization_level,
      contextualCoherence: row.contextual_coherence,
      datasetVersion: row.dataset_version,
    }));

    return NextResponse.json(cards);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

**Step 2: Run build + commit**

```bash
npm run build
git add app/api/cards/research/route.ts
git commit -m "feat: add research cards API route"
```

---

### Task 10: Answers + session API route

**Files:**
- Create: `app/api/answers/route.ts`

**Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { AnswerEvent, SessionPayload } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: { answer: AnswerEvent; session: SessionPayload } = await req.json();
    const supabase = getSupabaseAdminClient();

    // Insert answer event
    const { error: answerError } = await supabase.from('answers').insert({
      session_id: body.answer.sessionId,
      card_id: body.answer.cardId,
      card_source: body.answer.cardSource,
      is_phishing: body.answer.isPhishing,
      technique: body.answer.technique,
      secondary_technique: body.answer.secondaryTechnique,
      is_genai_suspected: body.answer.isGenaiSuspected,
      genai_confidence: body.answer.genaiConfidence,
      grammar_quality: body.answer.grammarQuality,
      prose_fluency: body.answer.proseFluency,
      personalization_level: body.answer.personalizationLevel,
      contextual_coherence: body.answer.contextualCoherence,
      difficulty: body.answer.difficulty,
      type: body.answer.type,
      user_answer: body.answer.userAnswer,
      correct: body.answer.correct,
      confidence: body.answer.confidence,
      time_from_render_ms: body.answer.timeFromRenderMs,
      time_from_confidence_ms: body.answer.timeFromConfidenceMs,
      confidence_selection_time_ms: body.answer.confidenceSelectionTimeMs,
      scroll_depth_pct: body.answer.scrollDepthPct,
      answer_method: body.answer.answerMethod,
      answer_ordinal: body.answer.answerOrdinal,
      streak_at_answer_time: body.answer.streakAtAnswerTime,
      correct_count_at_time: body.answer.correctCountAtTime,
      game_mode: body.answer.gameMode,
      is_daily_challenge: body.answer.isDailyChallenge,
      dataset_version: body.answer.datasetVersion,
    });

    if (answerError) throw answerError;

    // Upsert session (updates on each answer so completed_at and cards_answered stay current)
    const { error: sessionError } = await supabase.from('sessions').upsert({
      session_id: body.session.sessionId,
      game_mode: body.session.gameMode,
      is_daily_challenge: body.session.isDailyChallenge,
      started_at: body.session.startedAt,
      completed_at: body.session.completedAt,
      cards_answered: body.session.cardsAnswered,
      final_score: body.session.finalScore,
      final_rank: body.session.finalRank,
      device_type: body.session.deviceType,
      viewport_width: body.session.viewportWidth,
      viewport_height: body.session.viewportHeight,
      referrer: body.session.referrer,
    }, { onConflict: 'session_id' });

    if (sessionError) throw sessionError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Silently fail — never break the game over analytics
    console.error('Answer logging failed:', err);
    return NextResponse.json({ ok: true });
  }
}
```

**Note:** The route always returns `{ ok: true }` even on error. Answer logging must never break the game.

**Step 2: Run build + commit**

```bash
npm run build
git add app/api/answers/route.ts
git commit -m "feat: add answer event logging API route"
```

---

### Task 11: Intel aggregation API route

**Files:**
- Create: `app/api/intel/route.ts`

**Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export const revalidate = 300; // cache for 5 minutes

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: answers } = await supabase
      .from('answers')
      .select('correct, technique, is_genai_suspected, genai_confidence, prose_fluency, grammar_quality, confidence, time_from_render_ms, difficulty, type, card_source')
      .eq('game_mode', 'research');

    if (!answers || answers.length === 0) {
      return NextResponse.json({ totalAnswers: 0, insufficient: true });
    }

    const total = answers.length;
    const correct = answers.filter((a) => a.correct).length;
    const overallBypassRate = Math.round(((total - correct) / total) * 100);

    // Bypass rate by technique
    const techniqueMap: Record<string, { total: number; bypassed: number }> = {};
    for (const a of answers) {
      if (!a.technique) continue;
      if (!techniqueMap[a.technique]) techniqueMap[a.technique] = { total: 0, bypassed: 0 };
      techniqueMap[a.technique].total++;
      if (!a.correct) techniqueMap[a.technique].bypassed++;
    }
    const byTechnique = Object.entries(techniqueMap)
      .filter(([, v]) => v.total >= 10)
      .map(([technique, v]) => ({
        technique,
        total: v.total,
        bypassRate: Math.round((v.bypassed / v.total) * 100),
      }))
      .sort((a, b) => b.bypassRate - a.bypassRate);

    // High fluency (4-5) vs low fluency (0-2) bypass rate
    const highFluency = answers.filter((a) => a.prose_fluency !== null && a.prose_fluency >= 4);
    const lowFluency = answers.filter((a) => a.prose_fluency !== null && a.prose_fluency <= 2);
    const highFluencyBypassRate = highFluency.length
      ? Math.round((highFluency.filter((a) => !a.correct).length / highFluency.length) * 100) : null;
    const lowFluencyBypassRate = lowFluency.length
      ? Math.round((lowFluency.filter((a) => !a.correct).length / lowFluency.length) * 100) : null;

    // GenAI suspected (medium/high confidence) bypass rate
    const genaiAnswers = answers.filter((a) => a.is_genai_suspected && ['medium', 'high'].includes(a.genai_confidence ?? ''));
    const nonGenaiAnswers = answers.filter((a) => a.is_genai_suspected === false);
    const genaiBypassRate = genaiAnswers.length
      ? Math.round((genaiAnswers.filter((a) => !a.correct).length / genaiAnswers.length) * 100) : null;
    const traditionalBypassRate = nonGenaiAnswers.length
      ? Math.round((nonGenaiAnswers.filter((a) => !a.correct).length / nonGenaiAnswers.length) * 100) : null;

    // Confidence calibration
    const byConfidence = (['guessing', 'likely', 'certain'] as const).map((conf) => {
      const subset = answers.filter((a) => a.confidence === conf);
      return {
        confidence: conf,
        total: subset.length,
        accuracyRate: subset.length ? Math.round((subset.filter((a) => a.correct).length / subset.length) * 100) : 0,
      };
    });

    return NextResponse.json({
      totalAnswers: total,
      overallBypassRate,
      byTechnique,
      fluency: { highFluencyBypassRate, lowFluencyBypassRate, highFluencySample: highFluency.length, lowFluencySample: lowFluency.length },
      genai: { genaiBypassRate, traditionalBypassRate, genaiSample: genaiAnswers.length, traditionalSample: nonGenaiAnswers.length },
      byConfidence,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

**Step 2: Run build + commit**

```bash
npm run build
git add app/api/intel/route.ts
git commit -m "feat: add intel analytics aggregation API route"
```

---

### Task 12: Public /intel analytics page

**Files:**
- Create: `app/intel/page.tsx`

**Step 1: Write the page**

```tsx
import Link from 'next/link';

interface IntelData {
  totalAnswers: number;
  insufficient?: boolean;
  overallBypassRate: number;
  byTechnique: { technique: string; total: number; bypassRate: number }[];
  fluency: {
    highFluencyBypassRate: number | null;
    lowFluencyBypassRate: number | null;
    highFluencySample: number;
    lowFluencySample: number;
  };
  genai: {
    genaiBypassRate: number | null;
    traditionalBypassRate: number | null;
    genaiSample: number;
    traditionalSample: number;
  };
  byConfidence: { confidence: string; total: number; accuracyRate: number }[];
}

async function getIntel(): Promise<IntelData | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/intel`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="term-border bg-[#060c06] px-3 py-3 text-center">
      <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">{label}</div>
      <div className="text-[#00ff41] text-2xl font-black font-mono glow mt-1">{value}</div>
      {sub && <div className="text-[#003a0e] text-[10px] font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function IntelPage() {
  const data = await getIntel();

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-4 mt-8">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">THREAT_INTELLIGENCE</span>
            <Link href="/" className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28]">← TERMINAL</Link>
          </div>
          <div className="px-3 py-3 space-y-1">
            <div className="text-[#00ff41] text-xs font-mono">STATE OF PHISHING IN THE GENAI ERA</div>
            <div className="text-[#003a0e] text-[10px] font-mono">
              Live aggregate findings from the Retro Phish research dataset.
              Answers from Research Mode only. Updated every 5 minutes.
            </div>
          </div>
        </div>

        {!data || data.insufficient ? (
          <div className="term-border bg-[#060c06] px-3 py-6 text-center">
            <div className="text-[#00aa28] text-xs font-mono">COLLECTING DATA...</div>
            <div className="text-[#003a0e] text-[10px] font-mono mt-1">Insufficient sample size. Check back once Research Mode is live.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="TOTAL ANSWERS" value={data.totalAnswers.toLocaleString()} />
              <StatBlock label="OVERALL BYPASS RATE" value={`${data.overallBypassRate}%`} sub="phishing not detected" />
            </div>

            {(data.fluency.highFluencyBypassRate !== null || data.fluency.lowFluencyBypassRate !== null) && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">PROSE QUALITY vs BYPASS RATE</span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  {data.fluency.highFluencyBypassRate !== null && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#00aa28]">HIGH FLUENCY (4–5/5)</span>
                      <div className="text-right">
                        <span className="text-[#ff3333] font-bold">{data.fluency.highFluencyBypassRate}%</span>
                        <span className="text-[#003a0e] text-[10px] ml-1">n={data.fluency.highFluencySample}</span>
                      </div>
                    </div>
                  )}
                  {data.fluency.lowFluencyBypassRate !== null && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#00aa28]">LOW FLUENCY (0–2/5)</span>
                      <div className="text-right">
                        <span className="text-[#00ff41] font-bold">{data.fluency.lowFluencyBypassRate}%</span>
                        <span className="text-[#003a0e] text-[10px] ml-1">n={data.fluency.lowFluencySample}</span>
                      </div>
                    </div>
                  )}
                  <div className="text-[#003a0e] text-[10px] font-mono pt-1">
                    Higher fluency = harder to detect. GenAI phishing exploits this gap.
                  </div>
                </div>
              </div>
            )}

            {(data.genai.genaiBypassRate !== null || data.genai.traditionalBypassRate !== null) && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">GENAI vs TRADITIONAL PHISHING</span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  {data.genai.genaiBypassRate !== null && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#ffaa00]">GENAI SUSPECTED</span>
                      <div className="text-right">
                        <span className="text-[#ff3333] font-bold">{data.genai.genaiBypassRate}%</span>
                        <span className="text-[#003a0e] text-[10px] ml-1">n={data.genai.genaiSample}</span>
                      </div>
                    </div>
                  )}
                  {data.genai.traditionalBypassRate !== null && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#00aa28]">TRADITIONAL</span>
                      <div className="text-right">
                        <span className="text-[#00ff41] font-bold">{data.genai.traditionalBypassRate}%</span>
                        <span className="text-[#003a0e] text-[10px] ml-1">n={data.genai.traditionalSample}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.byTechnique.length > 0 && (
              <div className="term-border bg-[#060c06]">
                <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                  <span className="text-[#00aa28] text-xs tracking-widest">BYPASS RATE BY TECHNIQUE</span>
                </div>
                <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                  {data.byTechnique.map(({ technique, bypassRate, total }) => (
                    <div key={technique} className="flex items-center px-3 py-2 gap-3">
                      <span className="text-[#00aa28] text-xs font-mono flex-1">{technique}</span>
                      <div className="w-20 h-1 bg-[#003a0e]">
                        <div className="h-full bg-[#ff3333]" style={{ width: `${bypassRate}%` }} />
                      </div>
                      <span className="text-[#ff3333] text-xs font-mono w-8 text-right">{bypassRate}%</span>
                      <span className="text-[#003a0e] text-[10px] font-mono">n={total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="term-border bg-[#060c06]">
              <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
                <span className="text-[#00aa28] text-xs tracking-widest">CONFIDENCE CALIBRATION</span>
              </div>
              <div className="divide-y divide-[rgba(0,255,65,0.08)]">
                {data.byConfidence.map(({ confidence, accuracyRate, total }) => (
                  <div key={confidence} className="flex items-center px-3 py-2 gap-3">
                    <span className="text-[#00aa28] text-xs font-mono flex-1">{confidence.toUpperCase()}</span>
                    <span className="text-[#00ff41] text-xs font-mono">{accuracyRate}% accurate</span>
                    <span className="text-[#003a0e] text-[10px] font-mono">n={total}</span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 text-[#003a0e] text-[10px] font-mono">
                Are players who bet CERTAIN actually more accurate?
              </div>
            </div>

            <div className="term-border bg-[#060c06] px-3 py-3 text-[10px] font-mono text-[#003a0e] space-y-1 leading-relaxed">
              <div className="text-[#00aa28]">METHODOLOGY</div>
              <div>Research Mode only. Anonymous, voluntary. Text-based recognition task — visual cues stripped. Self-selected security-aware sample. GenAI classification is probabilistic based on linguistic characteristics, not ground truth. Sample sizes shown as n=.</div>
              <div className="mt-2">
                Full methodology: <span className="text-[#00aa28]">retro-phish.scottaltiparmak.com/docs/research/methodology</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Run build + commit**

```bash
npm run build
git add app/intel/page.tsx
git commit -m "feat: add public /intel research analytics page"
```

---

### Task 13: Update StartScreen with Research Mode

**Files:**
- Modify: `components/StartScreen.tsx`

**Step 1: Read the file first**

Read `components/StartScreen.tsx` to confirm current state.

**Step 2: Add Research Mode button**

Find the `FREEPLAY` button:
```tsx
          {/* Freeplay button - secondary */}
          <button
            onClick={() => onStart('freeplay')}
            className="w-full py-3 term-border text-[#00aa28] font-mono font-bold tracking-widest text-xs hover:bg-[rgba(0,255,65,0.05)] active:scale-95 transition-all"
          >
            [ FREEPLAY ]
          </button>

          <p className="text-[#003a0e] text-xs text-center font-mono">
            10 questions per round · email + SMS · randomized
          </p>
```

Replace with:
```tsx
          {/* Freeplay button - secondary */}
          <button
            onClick={() => onStart('freeplay')}
            className="w-full py-3 term-border text-[#00aa28] font-mono font-bold tracking-widest text-xs hover:bg-[rgba(0,255,65,0.05)] active:scale-95 transition-all"
          >
            [ FREEPLAY ]
          </button>

          {/* Research Mode button */}
          <button
            onClick={() => onStart('research')}
            className="w-full py-3 term-border text-[#ffaa00] border-[rgba(255,170,0,0.4)] font-mono font-bold tracking-widest text-xs hover:bg-[rgba(255,170,0,0.05)] active:scale-95 transition-all"
          >
            [ RESEARCH MODE — REAL DATA ]
          </button>

          <p className="text-[#003a0e] text-xs text-center font-mono">
            10 questions per round · email + SMS · randomized
          </p>
```

**Step 3: Run build + commit**

```bash
npm run build
git add components/StartScreen.tsx
git commit -m "feat: add Research Mode button to StartScreen"
```

---

### Task 14: Update Game.tsx for research mode

**Files:**
- Modify: `components/Game.tsx`

**Step 1: Read the file first**

Read `components/Game.tsx` to confirm current state.

**Step 2: Add imports and session state**

Find the existing imports:
```typescript
import type { Card, Answer, Confidence, RoundResult, GameMode } from '@/lib/types';
```

Replace with:
```typescript
import type { Card, Answer, Confidence, RoundResult, GameMode, AnswerEvent, SessionPayload } from '@/lib/types';
```

Find the state declarations section (after `const { soundEnabled, toggleSound } = useSoundEnabled();`):
```typescript
  const { soundEnabled, toggleSound } = useSoundEnabled();
```

Replace with:
```typescript
  const { soundEnabled, toggleSound } = useSoundEnabled();
  const sessionId = useRef<string>('');
  const sessionStartedAt = useRef<string>('');
  const [correctCount, setCorrectCount] = useState(0);
```

Add `useRef` to the React import:
```typescript
import { useState, useRef } from 'react';
```

**Step 3: Update startRound to initialise session**

Find:
```typescript
  function startRound(newMode: GameMode = 'freeplay') {
```

Replace with:
```typescript
  function generateSessionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const w = window.innerWidth;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  function startRound(newMode: GameMode = 'freeplay') {
    sessionId.current = generateSessionId();
    sessionStartedAt.current = new Date().toISOString();
```

**Step 4: Add research deck fetch in startRound**

Find inside `startRound`:
```typescript
    setMode(newMode);
    setDeck(newMode === 'daily' ? getDailyDeck() : getShuffledDeck(ROUND_SIZE));
    setCurrentIndex(0);
    setResults([]);
    setLastResult(null);
    setStreak(0);
    setTotalScore(0);
    setPhase('playing');
```

Replace with:
```typescript
    setMode(newMode);
    setCurrentIndex(0);
    setResults([]);
    setLastResult(null);
    setStreak(0);
    setTotalScore(0);
    setCorrectCount(0);

    if (newMode === 'research') {
      setPhase('loading' as GamePhase);
      fetch('/api/cards/research')
        .then((r) => r.json())
        .then((cards: Card[]) => {
          if (!cards.length) { setPhase('start'); return; }
          const shuffled = [...cards].sort(() => Math.random() - 0.5).slice(0, ROUND_SIZE);
          setDeck(shuffled);
          setPhase('playing');
        })
        .catch(() => setPhase('start'));
    } else {
      setDeck(newMode === 'daily' ? getDailyDeck() : getShuffledDeck(ROUND_SIZE));
      setPhase('playing');
    }
```

Also add `'loading'` to the GamePhase type:
```typescript
type GamePhase = 'start' | 'playing' | 'feedback' | 'summary' | 'daily_complete' | 'loading';
```

**Step 5: Add answer event logging in handleAnswer**

Find the end of `handleAnswer`:
```typescript
    setTotalScore((prev) => prev + pointsEarned);

    if (soundEnabled) {
      if (streakBonus > 0) playStreak();
      else if (correct) playCorrect();
      else playWrong();
    }

    setPhase('feedback');
  }
```

Replace with:
```typescript
    const newCorrectCount = correct ? correctCount + 1 : correctCount;
    setCorrectCount(newCorrectCount);
    setTotalScore((prev) => prev + pointsEarned);

    if (soundEnabled) {
      if (streakBonus > 0) playStreak();
      else if (correct) playCorrect();
      else playWrong();
    }

    // Log answer event (fire and forget — never block the game)
    if (typeof window !== 'undefined') {
      const researchCard = card as Card & Record<string, unknown>;
      const answerEvent: AnswerEvent = {
        sessionId: sessionId.current,
        cardId: card.id,
        cardSource: (researchCard.cardSource as 'generated' | 'real') ?? 'generated',
        isPhishing: card.isPhishing,
        technique: (researchCard.technique as string | null) ?? null,
        secondaryTechnique: (researchCard.secondaryTechnique as string | null) ?? null,
        isGenaiSuspected: (researchCard.isGenaiSuspected as boolean | null) ?? null,
        genaiConfidence: (researchCard.genaiConfidence as string | null) ?? null,
        grammarQuality: (researchCard.grammarQuality as number | null) ?? null,
        proseFluency: (researchCard.proseFluency as number | null) ?? null,
        personalizationLevel: (researchCard.personalizationLevel as number | null) ?? null,
        contextualCoherence: (researchCard.contextualCoherence as number | null) ?? null,
        difficulty: card.difficulty,
        type: card.type,
        userAnswer: answer,
        correct,
        confidence,
        timeFromRenderMs: null, // set by GameCard via onAnswer extended payload
        timeFromConfidenceMs: null,
        confidenceSelectionTimeMs: null,
        scrollDepthPct: 0,
        answerMethod: 'button',
        answerOrdinal: currentIndex + 1,
        streakAtAnswerTime: streak,
        correctCountAtTime: newCorrectCount,
        gameMode: mode,
        isDailyChallenge: mode === 'daily',
        datasetVersion: (researchCard.datasetVersion as string | null) ?? null,
      };

      const sessionPayload: SessionPayload = {
        sessionId: sessionId.current,
        gameMode: mode,
        isDailyChallenge: mode === 'daily',
        startedAt: sessionStartedAt.current,
        completedAt: null,
        cardsAnswered: currentIndex + 1,
        finalScore: null,
        finalRank: null,
        deviceType: getDeviceType(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        referrer: document.referrer,
      };

      fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerEvent, session: sessionPayload }),
      }).catch(() => {});
    }

    setPhase('feedback');
  }
```

**Step 6: Add loading phase render and pass mode/results to RoundSummary**

Find the loading phase render area (after `if (phase === 'start')`):
```typescript
  if (phase === 'start') {
    return <StartScreen onStart={startRound} />;
  }
```

Add immediately after:
```typescript
  if (phase === ('loading' as GamePhase)) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <span className="text-[#00aa28] font-mono text-xs tracking-widest">LOADING RESEARCH DATA...</span>
      </div>
    );
  }
```

**Step 7: Pass mode and results to RoundSummary for weakness tracking**

The RoundSummary already receives `mode` and `results` — no change needed here.

**Step 8: Run build**

```bash
npm run build
```

Expected: Clean compile.

**Step 9: Commit**

```bash
git add components/Game.tsx
git commit -m "feat: add research mode to Game — session tracking, card fetch, answer logging"
```

---

### Task 15: Add timing + scroll depth to GameCard

**Files:**
- Modify: `components/GameCard.tsx`

**Step 1: Read the file first**

Read `components/GameCard.tsx` to confirm current state.

**Step 2: Add timing refs and scroll depth state**

Find the refs section:
```typescript
  const answered   = useRef(false);
  const dragging   = useRef(false);
  const startX     = useRef(0);
```

Add timing refs before this:
```typescript
  const renderTime          = useRef<number>(Date.now());
  const confidenceTime      = useRef<number | null>(null);
  const maxScrollDepth      = useRef<number>(0);
```

**Step 3: Record confidence selection time**

Find `setConfidence(opt.value)` in the confidence button onClick:
```typescript
                onClick={() => setConfidence(opt.value)}
```

Replace with:
```typescript
                onClick={() => { setConfidence(opt.value); confidenceTime.current = Date.now(); }}
```

Also find the `[change]` button that resets confidence:
```typescript
              onClick={() => { if (!answered.current) { setConfidence(null); setDragX(0); } }}
```

Replace with:
```typescript
              onClick={() => { if (!answered.current) { setConfidence(null); setDragX(0); confidenceTime.current = null; } }}
```

**Step 4: Track scroll depth on the email body**

The email body div is in `EmailDisplay` and `SMSDisplay`. These are subcomponents. We need scroll tracking at the GameCard level via a callback prop, or we can add an `onScroll` prop to both display components.

Simplest approach: pass an `onScroll` handler down to both display components.

Find the `EmailDisplay` function signature:
```typescript
function EmailDisplay({ card }: { card: Card }) {
```

Replace with:
```typescript
function EmailDisplay({ card, onScroll }: { card: Card; onScroll?: (pct: number) => void }) {
```

Find the body div in `EmailDisplay`:
```tsx
      <div className="px-3 py-3 text-xs text-[#00aa28] leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto font-mono">
```

Replace with:
```tsx
      <div
        className="px-3 py-3 text-xs text-[#00aa28] leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto font-mono"
        onScroll={(e) => {
          const el = e.currentTarget;
          const pct = Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100);
          onScroll?.(pct);
        }}
      >
```

Do the same for `SMSDisplay` — same signature change and same `onScroll` on the body div.

**Step 5: Pass scroll callback and render-time timing to onAnswer**

Find the `fly` function:
```typescript
  function fly(direction: 'left' | 'right', conf: Confidence) {
    if (answered.current) return;
    answered.current = true;
    cancelAnimationFrame(rafId.current);
    setFlying(true);
    // CSS transition takes over for the fly-off
    setTimeout(() => onAnswer(direction === 'left' ? 'phishing' : 'legit', conf), 230);
  }
```

Replace with:
```typescript
  function fly(direction: 'left' | 'right', conf: Confidence, method: 'swipe' | 'button' = 'button') {
    if (answered.current) return;
    answered.current = true;
    cancelAnimationFrame(rafId.current);
    setFlying(true);
    const now = Date.now();
    const timeFromRender = now - renderTime.current;
    const timeFromConfidence = confidenceTime.current !== null ? now - confidenceTime.current : null;
    const confidenceSelectionTime = confidenceTime.current !== null ? confidenceTime.current - renderTime.current : null;
    setTimeout(() => onAnswer(
      direction === 'left' ? 'phishing' : 'legit',
      conf,
      {
        timeFromRenderMs: timeFromRender,
        timeFromConfidenceMs: timeFromConfidence,
        confidenceSelectionTimeMs: confidenceSelectionTime,
        scrollDepthPct: maxScrollDepth.current,
        answerMethod: method,
      }
    ), 230);
  }
```

**Step 6: Update fly calls to include method**

Find `fly(x > 0 || vx > 0 ? 'right' : 'left', confidence)` in `handlePointerUp`:
```typescript
      fly(x > 0 || vx > 0 ? 'right' : 'left', confidence);
```

Replace with:
```typescript
      fly(x > 0 || vx > 0 ? 'right' : 'left', confidence, 'swipe');
```

Find `fly(answer === 'phishing' ? 'left' : 'right', confidence)` in `handleButton`:
```typescript
    fly(answer === 'phishing' ? 'left' : 'right', confidence);
```

Replace with:
```typescript
    fly(answer === 'phishing' ? 'left' : 'right', confidence, 'button');
```

**Step 7: Update onAnswer prop type and pass scroll callback to display components**

Find the Props interface:
```typescript
  onAnswer: (answer: Answer, confidence: Confidence) => void;
```

Replace with:
```typescript
  onAnswer: (answer: Answer, confidence: Confidence, timing?: {
    timeFromRenderMs: number;
    timeFromConfidenceMs: number | null;
    confidenceSelectionTimeMs: number | null;
    scrollDepthPct: number;
    answerMethod: 'swipe' | 'button';
  }) => void;
```

Find the card display render:
```tsx
          {card.type === 'email' ? <EmailDisplay card={card} /> : <SMSDisplay card={card} />}
```

Replace with:
```tsx
          {card.type === 'email'
            ? <EmailDisplay card={card} onScroll={(pct) => { maxScrollDepth.current = Math.max(maxScrollDepth.current, pct); }} />
            : <SMSDisplay card={card} onScroll={(pct) => { maxScrollDepth.current = Math.max(maxScrollDepth.current, pct); }} />
          }
```

**Step 8: Update Game.tsx handleAnswer signature to accept timing**

In `Game.tsx`, find:
```typescript
  function handleAnswer(answer: Answer, confidence: Confidence) {
```

Replace with:
```typescript
  function handleAnswer(answer: Answer, confidence: Confidence, timing?: {
    timeFromRenderMs: number;
    timeFromConfidenceMs: number | null;
    confidenceSelectionTimeMs: number | null;
    scrollDepthPct: number;
    answerMethod: 'swipe' | 'button';
  }) {
```

And update the answerEvent in handleAnswer to use timing values:
```typescript
        timeFromRenderMs: timing?.timeFromRenderMs ?? null,
        timeFromConfidenceMs: timing?.timeFromConfidenceMs ?? null,
        confidenceSelectionTimeMs: timing?.confidenceSelectionTimeMs ?? null,
        scrollDepthPct: timing?.scrollDepthPct ?? 0,
        answerMethod: timing?.answerMethod ?? 'button',
```

**Step 9: Run build**

```bash
npm run build
```

Expected: Clean compile.

**Step 10: Commit**

```bash
git add components/GameCard.tsx components/Game.tsx
git commit -m "feat: add timing measurements and scroll depth tracking to GameCard"
```

---

### Task 16: Weakness tracking on RoundSummary

**Files:**
- Create: `lib/weakness-tracker.ts`
- Modify: `components/RoundSummary.tsx`

**Step 1: Create `lib/weakness-tracker.ts`**

```typescript
const STORAGE_KEY = 'weakness_history';

export interface WeaknessHistory {
  [technique: string]: { attempts: number; missed: number };
}

export function getWeaknessHistory(): WeaknessHistory {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function updateWeaknessHistory(results: { technique: string | null; correct: boolean }[]): WeaknessHistory {
  const history = getWeaknessHistory();
  for (const { technique, correct } of results) {
    if (!technique) continue;
    if (!history[technique]) history[technique] = { attempts: 0, missed: 0 };
    history[technique].attempts++;
    if (!correct) history[technique].missed++;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return history;
}

export function getWeakPoints(history: WeaknessHistory, minAttempts = 2): { technique: string; missRate: number; missed: number; attempts: number }[] {
  return Object.entries(history)
    .filter(([, v]) => v.attempts >= minAttempts)
    .map(([technique, v]) => ({
      technique,
      missRate: Math.round((v.missed / v.attempts) * 100),
      missed: v.missed,
      attempts: v.attempts,
    }))
    .filter((v) => v.missRate > 0)
    .sort((a, b) => b.missRate - a.missRate)
    .slice(0, 3);
}
```

**Step 2: Modify RoundSummary to show weakness data**

Read `components/RoundSummary.tsx` to confirm current state.

Find the import at the top:
```typescript
import type { RoundResult, GameMode } from '@/lib/types';
```

Replace with:
```typescript
import type { RoundResult, GameMode } from '@/lib/types';
import { updateWeaknessHistory, getWeakPoints } from '@/lib/weakness-tracker';
```

Find the state declarations at the top of `RoundSummary`:
```typescript
  const [dailyLeaderboard, setDailyLeaderboard] = useState<{ name: string; score: number }[]>([]);
```

Add after:
```typescript
  const [weakPoints, setWeakPoints] = useState<{ technique: string; missRate: number; missed: number; attempts: number }[]>([]);
```

Find the existing `useEffect` that fetches the daily leaderboard:
```typescript
  useEffect(() => {
    if (mode !== 'daily') return;
    fetch(`/api/leaderboard?date=${date}`)
```

Add a new `useEffect` before it to compute weakness (only in research mode):
```typescript
  useEffect(() => {
    if (mode !== 'research') return;
    const techniqueResults = results.map((r) => ({
      technique: (r.card as Record<string, unknown>).technique as string | null ?? null,
      correct: r.correct,
    }));
    const updated = updateWeaknessHistory(techniqueResults);
    setWeakPoints(getWeakPoints(updated));
  }, [mode, results]);
```

Find the round log section and add weakness display after it (before the leaderboard submission block):
```tsx
      {/* Weakness tracking — research mode only */}
      {mode === 'research' && weakPoints.length > 0 && (
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-xs tracking-widest">COGNITIVE_BLIND_SPOTS</span>
          </div>
          <div className="divide-y divide-[rgba(0,255,65,0.08)]">
            {weakPoints.map(({ technique, missRate, missed, attempts }) => (
              <div key={technique} className="flex items-center px-3 py-2 gap-3">
                <span className="text-[#ff3333] text-xs font-mono flex-1">{technique}</span>
                <span className="text-[#003a0e] text-[10px] font-mono">{missed}/{attempts}</span>
                <span className="text-[#ff3333] text-xs font-mono font-bold">{missRate}% miss</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 text-[10px] font-mono text-[#003a0e]">
            Based on your session history. Stored locally.
          </div>
        </div>
      )}
```

**Step 3: Run build**

```bash
npm run build
```

Expected: Clean compile.

**Step 4: Commit**

```bash
git add lib/weakness-tracker.ts components/RoundSummary.tsx
git commit -m "feat: add weakness tracking for research mode in RoundSummary"
```

---

### Task 17: Import script skeleton — PAUSE POINT

**Files:**
- Create: `scripts/import-corpus.ts`

**Step 1: Write the skeleton**

```typescript
/**
 * Import Corpus Script — Skeleton
 *
 * Reads raw email files from a local directory and writes them to cards_staging.
 * Does NOT run AI preprocessing — that is a separate script (scripts/run-preprocessing.ts).
 * Does NOT modify any existing data.
 *
 * Usage:
 *   npx ts-node scripts/import-corpus.ts --dir ./corpus/anydotrun --corpus anydotrun --phishing true
 *
 * Expected input: directory of .eml, .txt, or .json files (one email per file)
 *
 * ⚠ STOP AFTER WRITING THIS FILE.
 * Do not write run-preprocessing.ts. Do not run this script.
 * Evaluate corpus sources and pipeline design before proceeding.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Supabase client — imported directly (not via Next.js lib/) for script use
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

// ---------------------------------------------------------------------------
// Email parsers — extend as needed for each corpus format
// ---------------------------------------------------------------------------

interface ParsedEmail {
  rawFrom: string;
  rawSubject: string | null;
  rawBody: string;
  receivedDate: string | null;
  hasHtml: boolean;
  inferredType: 'email' | 'sms';
}

function parseTextFile(content: string): ParsedEmail {
  // Simple parser for plain text format: looks for From:, Subject:, then body
  const lines = content.split('\n');
  let rawFrom = 'unknown';
  let rawSubject: string | null = null;
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().startsWith('from:')) {
      rawFrom = lines[i].slice(5).trim();
    } else if (lines[i].toLowerCase().startsWith('subject:')) {
      rawSubject = lines[i].slice(8).trim();
    } else if (lines[i].trim() === '') {
      bodyStart = i + 1;
      break;
    }
  }

  const rawBody = lines.slice(bodyStart).join('\n').trim();
  const hasHtml = rawBody.includes('<html') || rawBody.includes('<HTML');

  return { rawFrom, rawSubject, rawBody, receivedDate: null, hasHtml, inferredType: 'email' };
}

function parseJsonFile(content: string): ParsedEmail {
  // For corpora that export as JSON (e.g. { from, subject, body, date })
  const obj = JSON.parse(content);
  return {
    rawFrom: obj.from ?? obj.sender ?? 'unknown',
    rawSubject: obj.subject ?? null,
    rawBody: obj.body ?? obj.text ?? obj.content ?? '',
    receivedDate: obj.date ?? obj.received ?? null,
    hasHtml: (obj.body ?? '').includes('<html'),
    inferredType: 'email',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dir = getArg('--dir');
  const sourceCorpus = getArg('--corpus');
  const isPhishingArg = getArg('--phishing');

  if (!dir || !sourceCorpus || isPhishingArg === null) {
    console.error('Usage: ts-node scripts/import-corpus.ts --dir ./path --corpus name --phishing true|false');
    process.exit(1);
  }

  const isPhishing = isPhishingArg === 'true';
  const supabase = getAdminClient();

  // Create import batch record
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({ source_corpus: sourceCorpus, notes: `Manual import from ${dir}` })
    .select('batch_id')
    .single();

  if (batchError || !batch) {
    console.error('Failed to create import batch:', batchError?.message);
    process.exit(1);
  }

  const batchId = batch.batch_id;
  const files = fs.readdirSync(dir).filter((f) => /\.(eml|txt|json)$/i.test(f));
  console.log(`Found ${files.length} files in ${dir}`);

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Check for duplicate
    const { data: existing } = await supabase
      .from('cards_staging')
      .select('id')
      .eq('raw_email_hash', hash)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    let parsed: ParsedEmail;
    try {
      parsed = file.endsWith('.json') ? parseJsonFile(content) : parseTextFile(content);
    } catch {
      console.warn(`Skipping ${file} — parse error`);
      skipped++;
      continue;
    }

    if (!parsed.rawBody.trim()) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('cards_staging').insert({
      raw_email_hash: hash,
      import_batch_id: batchId,
      source_corpus: sourceCorpus,
      raw_from: parsed.rawFrom,
      raw_subject: parsed.rawSubject,
      raw_body: parsed.rawBody,
      received_date: parsed.receivedDate,
      has_html: parsed.hasHtml,
      inferred_type: parsed.inferredType,
      is_phishing: isPhishing,
      status: 'pending',
    });

    if (error) {
      console.warn(`Failed to insert ${file}:`, error.message);
      skipped++;
    } else {
      imported++;
    }
  }

  // Update batch counts
  await supabase
    .from('import_batches')
    .update({ raw_count: imported + skipped, processed_count: 0 })
    .eq('batch_id', batchId);

  console.log(`\nImport complete: ${imported} inserted, ${skipped} skipped`);
  console.log(`Batch ID: ${batchId}`);
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add scripts/import-corpus.ts
git commit -m "feat: add import corpus script skeleton (PAUSE POINT)"
```

**⚠ STOP HERE.** Do not write `scripts/run-preprocessing.ts`. Do not run the import script. The next step is to set up Supabase, run the schema, verify the full build, then evaluate corpus sources before importing any data.

---

### Final: Run full build + push

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean compile with no TypeScript errors.

**Step 2: Push**

```bash
git push origin master
```

Vercel will deploy. Verify:
- `/admin/login` loads (password gate)
- `/intel` loads (shows "COLLECTING DATA" until answers exist)
- StartScreen shows `[ RESEARCH MODE — REAL DATA ]` button
- Research Mode button on StartScreen routes through to game (will show loading then empty — no cards yet)
- Admin dashboard accessible after login
