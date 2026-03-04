# Forensic Signals Feedback Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `FORENSIC_SIGNALS` section to `FeedbackCard.tsx` that dynamically surfaces auth status, reply-to mismatch, and URL presence signals on every post-answer feedback screen.

**Architecture:** All signals are derived from fields already present on the `Card` object (`authStatus`, `replyTo`, `body`, `type`, `isPhishing`) — no backend changes, no API changes, no new data fetching. The section is rendered as a new JSX block inserted between `ANALYST_NOTES` and `RED_FLAGS_DETECTED`.

**Tech Stack:** React (Next.js App Router), TypeScript, Tailwind CSS v4, inline CSS for terminal aesthetic

---

### Task 1: Add FORENSIC_SIGNALS section to FeedbackCard

**Files:**
- Modify: `components/FeedbackCard.tsx` (between lines 165–168, after ANALYST_NOTES block, before RED_FLAGS_DETECTED block)

**Step 1: Locate the insertion point**

Open `components/FeedbackCard.tsx`. Find the `ANALYST_NOTES` block (around line 160):

```tsx
{/* Explanation */}
<div className="term-border bg-[#060c06]">
  <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
    <span className="text-[#00aa28] text-xs tracking-widest">ANALYST_NOTES</span>
  </div>
  <p className="px-3 py-3 text-xs text-[#00aa28] leading-relaxed font-mono">{card.explanation}</p>
</div>
```

The new section goes immediately after the closing `</div>` of this block, before the `{/* Red flags */}` comment.

**Step 2: Insert the FORENSIC_SIGNALS block**

Add this JSX block between ANALYST_NOTES and RED_FLAGS_DETECTED:

```tsx
{/* Forensic signals */}
{(() => {
  const signals: string[] = [];

  // Auth status — email only (SPF/DKIM/DMARC don't apply to SMS)
  if (card.type === 'email') {
    if (card.authStatus === 'fail') {
      signals.push('SPF/DKIM/DMARC: FAIL — sender could not authenticate with the claimed domain. Strong indicator of spoofing.');
    } else if (card.authStatus === 'unverified') {
      signals.push(wasPhishing
        ? 'SPF/DKIM/DMARC: NONE — authentication headers absent, consistent with domain spoofing.'
        : 'SPF/DKIM/DMARC: NONE — small senders often lack email authentication. Absence of auth headers alone is not a reliable phishing indicator.'
      );
    } else if (card.authStatus === 'verified') {
      signals.push(wasPhishing
        ? 'SPF/DKIM/DMARC: PASS — attacker registered a lookalike domain with valid authentication. Headers are clean; the domain name itself is the tell.'
        : 'SPF/DKIM/DMARC: PASS — sender domain authenticated correctly.'
      );
    }

    // Reply-To mismatch — email only
    if (card.replyTo) {
      signals.push(`Reply-To: ${card.replyTo} — replies would route to the attacker's address, not the sender's domain.`);
    }
  }

  // URL presence — applies to both email and SMS
  if (/https?:\/\/\S+/.test(card.body)) {
    signals.push('This email contained URLs. The URL inspector reveals the full destination before clicking.');
  }

  if (signals.length === 0) return null;

  return (
    <div className="term-border bg-[#060c06] border-[rgba(255,170,0,0.3)]">
      <div className="border-b border-[rgba(255,170,0,0.3)] px-3 py-1.5">
        <span className="text-[#ffaa00] text-xs tracking-widest">FORENSIC_SIGNALS</span>
      </div>
      <ul className="px-3 py-3 space-y-2">
        {signals.map((signal, i) => (
          <li key={i} className="flex gap-2 text-xs text-[#00aa28] font-mono">
            <span className="text-[#ffaa00] shrink-0">▸</span>
            <span>{signal}</span>
          </li>
        ))}
      </ul>
    </div>
  );
})()}
```

**Step 3: Fix the SMS URL label**

The URL signal text says "This email contained URLs" which is wrong for SMS cards. Change the push to:

```tsx
if (/https?:\/\/\S+/.test(card.body)) {
  signals.push(`This ${card.type === 'sms' ? 'message' : 'email'} contained URLs. The URL inspector reveals the full destination before clicking.`);
}
```

**Step 4: Verify no TypeScript errors**

Run:
```bash
cd "C:/Users/scott/Github Projects/phish-or-not" && npx tsc --noEmit
```
Expected: no errors. All fields used (`authStatus`, `replyTo`, `type`, `body`, `isPhishing`) are already on the `Card` interface in `lib/types.ts`.

**Step 5: Visual check**

Run `npm run dev` and play a round. After answering each card, confirm:
- Phishing card with easy/medium difficulty: FORENSIC_SIGNALS shows `FAIL` auth signal
- Phishing card with hard/extreme + replyTo: shows both auth signal and reply-to signal
- Legit card with `verified`: shows `PASS` auth signal
- Legit card with `unverified`: shows `NONE` auth signal with the "not reliable alone" note
- Any card with a URL in body: shows the URL inspector note
- SMS card: no auth/reply-to signals, only URL signal if body has a URL

**Step 6: Commit**

```bash
git add components/FeedbackCard.tsx
git commit -m "feat: add FORENSIC_SIGNALS section to post-answer feedback"
```
