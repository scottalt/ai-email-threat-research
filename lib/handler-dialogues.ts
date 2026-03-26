// SIGINT — Terminal AI handler dialogue system
// Each moment fires once per player (tracked in localStorage)

export interface HandlerDialogue {
  lines: string[];
  buttonText?: string; // default: "CONTINUE"
}

export const HANDLER_DIALOGUES: Record<string, HandlerDialogue> = {
  // ── Onboarding (new players only) ──

  boot_greeting: {
    lines: [
      "Welcome to the terminal, operative. I'm SIGINT — your threat analysis assistant.",
      "Incoming emails need classification. Some are legitimate. Some are AI-generated phishing. The writing quality is perfect in both — so you'll need to look deeper.",
      "Start with Research Mode below. Complete 10 classifications and I'll unlock PvP ranked matches for you.",
    ],
    buttonText: "LET'S GO",
  },

  research_brief: {
    lines: [
      "Before we start — this is a real research study. Your answers are anonymous and contribute to actual security research.",
      "I'll show you the tools. What you do with them is up to you.",
    ],
    buttonText: "SHOW ME",
  },

  tutorial_intro: {
    lines: [
      "This is a training simulation. I've loaded a sample email.",
      "See that sender address? Tap the arrow next to it. Also check the attachment and any URLs.",
      "I've highlighted the interactive elements for you.",
    ],
    buttonText: "I SEE THEM",
  },

  tutorial_complete: {
    lines: [
      "Not bad. Real emails won't have the training wheels.",
      "Your mission: classify 10 emails. Hit 10 and you unlock ranked PvP. Hit 30 and you get full access.",
      "Let's go.",
    ],
    buttonText: "READY",
  },

  first_research_start: {
    lines: [
      "Live data incoming. I can't tell you what to look for — that would defeat the purpose.",
      "Trust your instincts. Use the tools. I'll be here.",
    ],
    buttonText: "BEGIN",
  },

  // ── Milestone dialogues ──

  first_correct: {
    lines: [
      "Threat neutralized. See? You've got this.",
    ],
  },

  pvp_unlock: {
    lines: [
      "10 classifications logged. PvP mode is now online.",
      "Fair warning — the opponents are real. And some of them are annoyingly good.",
    ],
  },

  daily_unlock: {
    lines: [
      "Daily Challenge unlocked. Same 10 emails for everyone, once per day.",
      "Think of it as the morning briefing.",
    ],
  },

  freeplay_unlock: {
    lines: [
      "Research protocol complete. 30 classifications — you've contributed to real threat intelligence.",
      "Full access granted. Freeplay, Expert cards, the works. Welcome to the inner circle.",
    ],
  },

  first_pvp_win: {
    lines: [
      "First ranked win. Told you those training simulations would pay off.",
      "...I mean, I didn't tell you that. But I was thinking it.",
    ],
  },
};

/** Check if a handler moment has been seen */
export function hasSeenMoment(momentId: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem('handler_moments_seen') ?? '[]');
    return seen.includes(momentId);
  } catch { return false; }
}

/** Mark a handler moment as seen */
export function markMomentSeen(momentId: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem('handler_moments_seen') ?? '[]');
    if (!seen.includes(momentId)) {
      seen.push(momentId);
      localStorage.setItem('handler_moments_seen', JSON.stringify(seen));
    }
  } catch { /* ignore */ }
}
