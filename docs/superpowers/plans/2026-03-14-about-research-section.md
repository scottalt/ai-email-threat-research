# About This Research Section — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible ABOUT_THIS_RESEARCH section to the start screen with a study summary and external link.

**Architecture:** Single state variable + JSX block in StartScreen.tsx, following the existing SIGNAL GUIDE collapsible pattern.

**Tech Stack:** React, Next.js, Tailwind CSS

---

## Chunk 1: Add About This Research Section

### Task 1: Add collapsible section to StartScreen

**Files:**
- Modify: `components/StartScreen.tsx:63` (add state)
- Modify: `components/StartScreen.tsx:373` (add JSX after SIGNAL GUIDE closing div)

- [ ] **Step 1: Add showAbout state variable**

In `components/StartScreen.tsx`, after line 63 (`const [showGuide, setShowGuide] = useState(false);`), add:

```tsx
const [showAbout, setShowAbout] = useState(false);
```

- [ ] **Step 2: Add ABOUT_THIS_RESEARCH collapsible JSX**

In `components/StartScreen.tsx`, after line 373 (the closing `</div>` of the Signal Guide section), insert:

```tsx
{/* About this research */}
<div className="term-border bg-[#060c06] border-[rgba(0,255,65,0.3)]">
  <button
    onClick={() => setShowAbout((o) => !o)}
    className="w-full px-3 py-2 flex items-center justify-between text-sm font-mono hover:bg-[rgba(0,255,65,0.05)] transition-colors"
  >
    <span className="text-[#00ff41] tracking-widest">[i] ABOUT_THIS_RESEARCH</span>
    <span className="text-[#00ff41]">{showAbout ? '▲' : '▼'}</span>
  </button>
  {showAbout && (
    <div className="border-t border-[rgba(0,255,65,0.15)] px-3 py-3 space-y-3">
      <p className="text-[#33bb55] text-sm lg:text-base font-mono leading-relaxed">
        Threat Terminal is a research platform studying how humans detect AI-generated phishing emails. Every classification you make contributes to an empirical study on which phishing techniques are hardest to spot when AI eliminates traditional red flags like poor grammar.
      </p>
      <a
        href="https://scottaltiparmak.com/research"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-[#00ff41] text-sm font-mono tracking-widest hover:underline"
      >
        {'>'} READ_FULL_RESEARCH →
      </a>
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify locally**

Run: `npm run dev`

Check:
- Section appears on start screen below SIGNAL GUIDE
- Collapsed by default
- Expands/collapses on click
- Link opens scottaltiparmak.com/research in new tab
- Visible when signed out and signed in
- Green accent differentiates it from amber SIGNAL GUIDE

- [ ] **Step 4: Commit**

```bash
git add components/StartScreen.tsx
git commit -m "feat: add ABOUT_THIS_RESEARCH collapsible section to start screen"
```
