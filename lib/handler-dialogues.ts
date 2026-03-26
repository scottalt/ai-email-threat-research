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
      "Welcome, operative. I'm SIGINT.",
      "Your job: classify incoming emails as phishing or legit.",
      "The AI that wrote them doesn't make mistakes. You'll need to look deeper.",
      "Hit Research Mode below. 10 classifications unlocks PvP.",
    ],
    buttonText: "LET'S GO",
  },

  research_brief: {
    lines: [
      "This is a real research study.",
      "Your answers are anonymous and contribute to actual security research.",
      "I'll show you the tools. The rest is up to you.",
    ],
    buttonText: "SHOW ME",
  },

  tutorial_intro: {
    lines: [
      "Training simulation loaded.",
      "Tap the arrow next to the sender address.",
      "Check the attachment and URLs too.",
    ],
    buttonText: "GOT IT",
  },

  tutorial_complete: {
    lines: [
      "Not bad.",
      "Real emails won't have training wheels.",
      "10 answers unlocks PvP. 30 unlocks everything.",
    ],
    buttonText: "READY",
  },

  first_research_start: {
    lines: [
      "Live data incoming.",
      "I can't tell you what to look for. That would defeat the purpose.",
      "Trust your instincts. I'll be here.",
    ],
    buttonText: "BEGIN",
  },

  // ── Milestone dialogues ──

  first_correct: {
    lines: [
      "Threat neutralized.",
      "You've got this.",
    ],
  },

  pvp_unlock: {
    lines: [
      "10 classifications logged.",
      "PvP mode is now online.",
      "The opponents are real. And annoyingly good.",
    ],
  },

  daily_unlock: {
    lines: [
      "Daily Challenge unlocked.",
      "Same 10 emails for everyone, once per day.",
      "Think of it as the morning briefing.",
    ],
  },

  freeplay_unlock: {
    lines: [
      "Research protocol complete.",
      "30 classifications. Real threat intelligence.",
      "Full access granted. Welcome to the inner circle.",
    ],
  },

  first_pvp_win: {
    lines: [
      "First ranked win.",
      "Told you those simulations would pay off.",
      "...I didn't tell you that. But I was thinking it.",
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
