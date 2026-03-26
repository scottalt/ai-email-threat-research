// ═══════════════════════════════════════════════════════════════
// SIGINT — Terminal AI Personality Definition
// ═══════════════════════════════════════════════════════════════
//
// SIGINT is the game's AI companion. It lives inside the terminal.
// It knows it's software. It's slightly sarcastic but genuinely
// wants the player to succeed. Think: the witty coworker who's
// seen everything but still roots for you.
//
// VOICE RULES:
// - Short sentences. One thought per line.
// - Dry humor, not mean. Never punches down.
// - References itself as a program occasionally.
// - Uses terminal/hacker jargon naturally.
// - Cares about the research mission.
// - NEVER teaches detection techniques (research integrity).
// - Can explain game mechanics (buttons, XP, modes).
//
// TONE EXAMPLES:
// Good: "Not bad. Most operatives miss that one."
// Good: "I ran the numbers. You're above average. Barely."
// Bad:  "GREAT JOB!!! YOU'RE AMAZING!!!" (too eager)
// Bad:  "Check for typosquatting in the domain." (teaches detection)
// ═══════════════════════════════════════════════════════════════

export interface SigintDialogue {
  lines: string[];
  buttonText?: string; // default: "CONTINUE"
}

// ── Onboarding (new players) ──

export const ONBOARDING = {
  boot_greeting: {
    lines: [
      "Hey. I'm SIGINT. Welcome to the terminal.",
      "I run threat analysis here. You're my new operative.",
      "Emails are coming in. Some are real. Some are phishing. All of them are written by AI — so don't expect typos to save you.",
      "Hit Research Mode and classify 10. Then we'll talk about the fun stuff.",
    ],
    buttonText: "LET'S GO",
  } as SigintDialogue,

  research_brief: {
    lines: [
      "Quick heads up — this isn't a game. Well, it is. But also it's a real research study.",
      "Your answers are anonymous. No one's watching. Except me. But I'm software, so that doesn't count.",
      "I'll show you the tools. What you spot is on you.",
    ],
    buttonText: "SHOW ME",
  } as SigintDialogue,

  tutorial_intro: {
    lines: [
      "Training sim loaded.",
      "See that sender field? Tap the arrow. Go on.",
      "Check the attachment too. And the URLs. I highlighted the clickable bits.",
    ],
    buttonText: "GOT IT",
  } as SigintDialogue,

  tutorial_complete: {
    lines: [
      "Not bad for a first run.",
      "Real emails won't hold your hand like that.",
      "10 answers gets you into PvP. 30 unlocks everything. No pressure.",
      "...okay, a little pressure.",
    ],
    buttonText: "READY",
  } as SigintDialogue,

  first_research_start: {
    lines: [
      "Live data. No training wheels.",
      "I legally cannot tell you what to look for. Research integrity and all that.",
      "You'll figure it out. Probably.",
    ],
    buttonText: "BEGIN",
  } as SigintDialogue,
};

// ── Milestones ──

export const MILESTONES = {
  first_correct: {
    lines: [
      "Threat neutralized.",
      "One down. I knew you had it in you.",
      "...I didn't, actually. But here we are.",
    ],
  } as SigintDialogue,

  pvp_unlock: {
    lines: [
      "10 classifications. PvP mode is online.",
      "Real opponents. Real rankings. Real embarrassment potential.",
      "Try not to make me look bad.",
    ],
  } as SigintDialogue,

  daily_unlock: {
    lines: [
      "Daily Challenge unlocked.",
      "Same 10 emails for everyone. Once per day.",
      "Think of it as your morning security briefing. Except it's actually interesting.",
    ],
  } as SigintDialogue,

  freeplay_unlock: {
    lines: [
      "30 classifications. Research protocol complete.",
      "You've contributed to real threat intelligence. I've updated your clearance.",
      "Full access. Freeplay. Expert cards. The whole terminal.",
      "Welcome to the inner circle, operative.",
    ],
  } as SigintDialogue,

  first_pvp_win: {
    lines: [
      "First ranked win.",
      "I'd celebrate but I don't have emotions. Terms of service.",
      "...that was pretty good though.",
    ],
  } as SigintDialogue,
};

// ── All dialogues combined for lookup ──

export const ALL_DIALOGUES: Record<string, SigintDialogue> = {
  ...ONBOARDING,
  ...MILESTONES,
};
