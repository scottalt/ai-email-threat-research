# Tutorial Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a static interactive tutorial card to first-time Research Mode players after the ResearchIntro disclaimer, teaching forensic signals and confidence betting before their first real round.

**Architecture:** New `TutorialCard` component renders a hardcoded fake phishing email using the same visual patterns as GameCard (no swipe, no answer buttons, no logging). Game.tsx gains a `tutorial` phase inserted between `research_intro` and `playing`. Trigger: `profile.researchAnswersSubmitted === 0`. The ResearchIntro `onBegin` handler checks this condition and routes accordingly.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, TypeScript. No new dependencies.

---

### Task 1: Add `tutorial` phase to Game.tsx

**Files:**
- Modify: `components/Game.tsx`

**Step 1: Add `tutorial` to the GamePhase union type**

Find line 62:
```typescript
type GamePhase = 'start' | 'playing' | 'feedback' | 'summary' | 'daily_complete' | 'loading' | 'research_intro' | 'research_unavailable';
```
Change to:
```typescript
type GamePhase = 'start' | 'playing' | 'feedback' | 'summary' | 'daily_complete' | 'loading' | 'research_intro' | 'research_unavailable' | 'tutorial';
```

**Step 2: Import TutorialCard (will be created in Task 2)**

Add to existing imports near line 42:
```typescript
import { TutorialCard } from './TutorialCard';
```

**Step 3: Update ResearchIntro onBegin handler**

Currently line 343:
```typescript
return <ResearchIntro onBegin={() => setPhase('playing')} />;
```

The `onBegin` now needs to check if this is the user's first time. The `profile` object is available from `usePlayer()` — add it:

First, add `usePlayer` import and destructure near the top of the `Game` function. Check if it's already imported (search for `usePlayer` in Game.tsx — if not present, add):
```typescript
import { usePlayer } from '@/lib/usePlayer';
```

Then inside the `Game` function, add:
```typescript
const { profile } = usePlayer();
```

Then update the ResearchIntro render:
```typescript
if (phase === 'research_intro') {
  return (
    <ResearchIntro
      onBegin={() => {
        const isFirstTime = !profile || (profile.researchAnswersSubmitted ?? 0) === 0;
        setPhase(isFirstTime ? 'tutorial' : 'playing');
      }}
    />
  );
}
```

**Step 4: Add tutorial phase render block**

After the `research_intro` block (around line 344), add:
```typescript
if (phase === 'tutorial') {
  return <TutorialCard onComplete={() => setPhase('playing')} />;
}
```

**Step 5: Run type check**
```bash
npx tsc --noEmit
```
Expected: errors about TutorialCard not existing yet (that's fine — fix in Task 2). If there are other errors, fix them first.

**Step 6: Commit**
```bash
git add components/Game.tsx
git commit -m "feat: add tutorial phase to Game.tsx for first-time research players"
```

---

### Task 2: Create TutorialCard component

**Files:**
- Create: `components/TutorialCard.tsx`

**Step 1: Create the file**

```typescript
'use client';

import { useState } from 'react';

interface Props {
  onComplete: () => void;
}

const TUTORIAL_EMAIL = {
  from: 'security-alerts@paypa1.com',
  fromDisplay: 'PayPal Security',
  subject: 'Urgent: Your account has been limited',
  sentAt: 'Mar 9, 2026, 3:14 AM',
  attachmentName: 'account_recovery.zip',
  replyTo: 'support@gmail-helpdesk.com',
  body: `We have detected unusual activity on your PayPal account. To avoid permanent suspension, you must verify your identity immediately.

Your account access will be restricted in 24 hours if no action is taken.

Verify your account now: http://paypa1-secure.com/verify?token=a9f3k2xR

Do not ignore this message. Failure to verify will result in permanent account closure.

— PayPal Security Team`,
  url: 'http://paypa1-secure.com/verify?token=a9f3k2xR',
};

export function TutorialCard({ onComplete }: Props) {
  const [showHeaders, setShowHeaders] = useState(true); // pre-expanded
  const [showFrom, setShowFrom] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  return (
    <div className="anim-fade-in-up w-full max-w-sm px-4 flex flex-col gap-4 pb-safe">

      {/* Annotation strip */}
      <div className="term-border border-[rgba(255,170,0,0.5)] bg-[#060c06] px-3 py-3 space-y-1">
        <div className="text-[#ffaa00] text-xs font-mono font-bold tracking-widest">TRAINING_SIMULATION</div>
        <div className="text-[#00aa28] text-[10px] font-mono leading-relaxed">
          This card demonstrates the forensic signals used in Research Mode.
          Tap <span className="text-[#ffaa00]">[HEADERS]</span>, URLs, and{' '}
          <span className="text-[#ffaa00]">[↗]</span> on the sender to explore each tool.
        </div>
      </div>

      {/* Confidence block */}
      <div className="term-border bg-[#060c06] px-3 py-3 space-y-2">
        <div className="text-[#00aa28] text-[10px] font-mono tracking-widest">CONFIDENCE BETTING</div>
        <div className="text-[#003a0e] text-[10px] font-mono leading-relaxed">
          Before answering each card, set your confidence level:
        </div>
        <div className="space-y-1">
          {[
            { label: 'GUESSING', mult: '1×', note: 'no penalty if wrong', color: 'text-[#00aa28]' },
            { label: 'LIKELY',   mult: '2×', note: 'lose 100 pts if wrong', color: 'text-[#ffaa00]' },
            { label: 'CERTAIN',  mult: '3×', note: 'lose 200 pts if wrong', color: 'text-[#ff3333]' },
          ].map(({ label, mult, note, color }) => (
            <div key={label} className="flex items-center gap-2 text-[10px] font-mono">
              <span className={`w-16 font-bold ${color}`}>{label}</span>
              <span className="text-[#00ff41]">{mult}</span>
              <span className="text-[#003a0e]">— {note}</span>
            </div>
          ))}
        </div>
        <div className="text-[#003a0e] text-[10px] font-mono pt-1">
          Don&apos;t bet CERTAIN unless you&apos;re sure.
        </div>
      </div>

      {/* Fake email card */}
      <div className="term-border bg-[#060c06]">
        {/* Card header */}
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[#003a0e] text-[10px] font-mono tracking-widest">INCOMING_EMAIL</span>
          <button
            onClick={() => setShowHeaders((v) => !v)}
            className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
              showHeaders
                ? 'border-[rgba(0,255,65,0.6)] text-[#00ff41]'
                : 'border-[rgba(0,255,65,0.25)] text-[#003a0e] hover:text-[#00aa28]'
            }`}
          >
            [HEADERS]
          </button>
        </div>

        {/* Auth headers panel */}
        {showHeaders && (
          <div className="border-b border-[rgba(0,255,65,0.2)] px-3 py-2 bg-[#03080a] space-y-1">
            <div className="text-[#003a0e] text-[10px] font-mono tracking-widest mb-1">AUTH_HEADERS</div>
            {[
              { label: 'SPF', status: 'FAIL' },
              { label: 'DKIM', status: 'FAIL' },
              { label: 'DMARC', status: 'FAIL' },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-[#00aa28] w-12">{label}</span>
                <span className="text-[#ff3333] font-bold">{status}</span>
              </div>
            ))}
            <div className="pt-1 space-y-0.5">
              <div className="flex gap-2 text-[10px] font-mono">
                <span className="text-[#00aa28] w-16 shrink-0">REPLY-TO</span>
                <span className="text-[#ffaa00]">{TUTORIAL_EMAIL.replyTo}</span>
              </div>
            </div>
          </div>
        )}

        {/* Email metadata */}
        <div className="px-3 py-2 space-y-1 border-b border-[rgba(0,255,65,0.15)]">
          {/* FROM */}
          <div className="flex items-start gap-2 text-[10px] font-mono">
            <span className="text-[#003a0e] w-8 shrink-0 pt-0.5">FROM</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[#00ff41]">{TUTORIAL_EMAIL.fromDisplay}</span>
                <button
                  onClick={() => setShowFrom((v) => !v)}
                  className="text-[#003a0e] hover:text-[#00aa28] transition-colors"
                  aria-label="Reveal sender email"
                >
                  [↗]
                </button>
              </div>
              {showFrom && (
                <div className="text-[#ffaa00] mt-0.5 break-all">{TUTORIAL_EMAIL.from}</div>
              )}
            </div>
          </div>
          {/* SUBJ */}
          <div className="flex items-start gap-2 text-[10px] font-mono">
            <span className="text-[#003a0e] w-8 shrink-0 pt-0.5">SUBJ</span>
            <span className="text-[#00ff41] flex-1">{TUTORIAL_EMAIL.subject}</span>
          </div>
          {/* SENT */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-[#003a0e] w-8 shrink-0">SENT</span>
            <span className="text-[#00aa28]">{TUTORIAL_EMAIL.sentAt}</span>
          </div>
          {/* ATCH */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-[#003a0e] w-8 shrink-0">ATCH</span>
            <span className="text-[#ffaa00]">📎 {TUTORIAL_EMAIL.attachmentName}</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2 max-h-40 overflow-y-auto">
          <div className="text-[#00aa28] text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {TUTORIAL_EMAIL.body.replace(TUTORIAL_EMAIL.url, '')}
            <button
              onClick={() => setShowUrl((v) => !v)}
              className="text-[#ffaa00] underline underline-offset-2 hover:text-[#ffcc44] transition-colors"
            >
              {TUTORIAL_EMAIL.url}
            </button>
          </div>
        </div>

        {/* URL inspector */}
        {showUrl && (
          <div className="border-t border-[rgba(255,170,0,0.3)] px-3 py-2 bg-[#03080a]">
            <div className="text-[#003a0e] text-[10px] font-mono tracking-widest mb-1">URL_INSPECTOR</div>
            <div className="text-[#ffaa00] text-[10px] font-mono break-all">{TUTORIAL_EMAIL.url}</div>
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onComplete}
        className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
      >
        [ GOT IT — START RESEARCH ]
      </button>

    </div>
  );
}
```

**Step 2: Run type check**
```bash
npx tsc --noEmit
```
Expected: clean (no errors).

**Step 3: Commit**
```bash
git add components/TutorialCard.tsx components/Game.tsx
git commit -m "feat: add TutorialCard for first-time research players

Static training card showing a fabricated phishing email with all forensic
signals pre-loaded: typosquatted FROM, 3:14AM sent time, suspicious attachment,
HEADERS pre-expanded (SPF/DKIM/DMARC FAIL), Reply-To mismatch, suspicious URL.
Includes confidence betting explainer. Shown when researchAnswersSubmitted === 0.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Verify the flow end-to-end

**Step 1: Check the trigger logic**

In `components/Game.tsx`, confirm the `research_intro` render block now reads:
```typescript
if (phase === 'research_intro') {
  return (
    <ResearchIntro
      onBegin={() => {
        const isFirstTime = !profile || (profile.researchAnswersSubmitted ?? 0) === 0;
        setPhase(isFirstTime ? 'tutorial' : 'playing');
      }}
    />
  );
}
```

And the `tutorial` render block exists:
```typescript
if (phase === 'tutorial') {
  return <TutorialCard onComplete={() => setPhase('playing')} />;
}
```

**Step 2: Verify returning players skip the tutorial**

A user with `researchAnswersSubmitted > 0` clicks Research Mode:
- `hasSeenIntro` is `'1'` in localStorage → skips ResearchIntro entirely → goes straight to `playing`
- Even if they somehow hit `research_intro`, `isFirstTime` is false → goes to `playing`
- Tutorial never shows. ✓

**Step 3: Run final type check and push**
```bash
npx tsc --noEmit
git push origin master
```

---

## Notes

- `profile.researchAnswersSubmitted` is populated from `/api/player` — it already exists on the `PlayerProfile` type and is fetched on load.
- The `researchAnswersSubmitted` field — verify it exists in `lib/types.ts` as part of `PlayerProfile`. If it's named differently, adjust the check in Task 1 Step 3.
- Headers are pre-expanded (`useState(true)`) by design — users shouldn't have to discover them on the tutorial card.
- The tutorial card has no answer logging, no session tracking, no score impact.
