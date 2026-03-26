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

/** Generate a dynamic dialogue with player name inserted */
export function dynamicDialogue(id: string, callsign: string): SigintDialogue | null {
  switch (id) {
    case 'welcome_back': {
      const greetings: SigintDialogue[] = [
        { lines: [`${callsign}. You're back.`, "Miss me? Don't answer that."], buttonText: "LET'S GO" },
        { lines: [`Hey ${callsign}.`, "Emails piling up. You know the drill."], buttonText: "ON IT" },
        { lines: [`${callsign}. Right on time.`, "I've got fresh threats queued up."], buttonText: "SHOW ME" },
        { lines: ["Look who decided to show up.", `Welcome back, ${callsign}.`], buttonText: "MISSED YOU TOO" },
        { lines: [`${callsign}. Good timing.`, "New data just came in. Let's go."], buttonText: "READY" },
        { lines: ["Terminal's been quiet without you.", `Let's fix that, ${callsign}.`], buttonText: "LET'S GO" },
        { lines: [`${callsign}. Status: operational.`, "Mine, not yours. Yours is TBD."], buttonText: "WATCH ME" },
        { lines: ["Ah. My favorite operative.", `...you're my only operative, ${callsign}. Don't let it go to your head.`], buttonText: "TOO LATE" },
        { lines: [`${callsign}. I counted the seconds.`, "...kidding. I don't have a clock. I have a threat queue."], buttonText: "SURE" },
        { lines: ["Incoming operative detected.", `Threat level: ${callsign}. Proceed with caution.`], buttonText: "VERY FUNNY" },
        { lines: [`${callsign}. You look different.`, "Just kidding. I can't see you. But I know you're ready."], buttonText: "ALWAYS" },
        { lines: ["System log: operative returned.", `Note to self — ${callsign} actually came back. Adjusting expectations.`], buttonText: "RUDE" },
        { lines: [`${callsign}. Quick question.`, "Did you think about phishing while you were gone? Be honest."], buttonText: "...MAYBE" },
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
    case 'v2_intro':
      return {
        lines: [
          `${callsign}. We need to talk.`,
          "I'm SIGINT. New around here — they installed me in the v2 update.",
          "I run threat analysis now. PvP mode, ranked matches, badges — that's all me.",
          "Your research data carried over. Everything you've done still counts.",
          "But there's a lot of new stuff. Poke around. I'll be here if you need me.",
        ],
        buttonText: "GOT IT",
      };
    default:
      return null;
  }
}

// ── Onboarding (brand new players with 0 answers) ──

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
      "10 classifications logged. Not bad.",
      "You just unlocked PvP mode. Real opponents. Real rankings.",
      "Hit that PvP button on the main screen. I dare you.",
    ],
    buttonText: "BRING IT",
  } as SigintDialogue,

  daily_unlock: {
    lines: [
      "20 classifications. Daily Challenge just came online.",
      "Same 10 emails for everyone, once per day. Global leaderboard.",
      "Check the Daily button on the home screen. Show them what you've got.",
    ],
    buttonText: "ON IT",
  } as SigintDialogue,

  freeplay_unlock: {
    lines: [
      "30 classifications. Research protocol complete.",
      "Full clearance granted. Freeplay, Expert cards — the whole terminal is yours.",
      "You've earned it. The Freeplay button is on the home screen now.",
      "Welcome to the inner circle, operative.",
    ],
    buttonText: "FINALLY",
  } as SigintDialogue,

  first_pvp_win: {
    lines: [
      "First ranked win.",
      "I'd celebrate but I don't have emotions. Terms of service.",
      "...that was pretty good though.",
    ],
    buttonText: "GG",
  } as SigintDialogue,

  first_pvp_loss: {
    lines: [
      "First loss. Had to happen eventually.",
      "I ran diagnostics. Your hardware is fine. Software needs updating.",
      "Queue again. Show them that was a fluke.",
    ],
    buttonText: "REMATCH",
  } as SigintDialogue,

  loss_streak_3: {
    lines: [
      "Three in a row. I'm not going to sugarcoat it.",
      "But I've seen your data. You're better than this.",
      "Take a breath. Reset. The next one's yours.",
    ],
    buttonText: "WATCH ME",
  } as SigintDialogue,

  win_streak_3: {
    lines: [
      "Three straight wins. Opponents are starting to notice.",
      "I'd tell you not to get cocky, but honestly? Get a little cocky.",
    ],
    buttonText: "UNSTOPPABLE",
  } as SigintDialogue,

  win_streak_5: {
    lines: [
      "Five in a row. I'm logging this as a security incident.",
      "You're not supposed to be this good. I checked the spec.",
      "Keep going. I want to see what happens at ten.",
    ],
    buttonText: "LET'S FIND OUT",
  } as SigintDialogue,

  first_elimination: {
    lines: [
      "Eliminated. Wrong answer, instant out.",
      "PvP doesn't forgive. Neither do I.",
      "...okay, I forgive a little. Queue again.",
    ],
    buttonText: "AGAIN",
  } as SigintDialogue,

  perfect_match: {
    lines: [
      "5 for 5. Flawless.",
      "I checked my threat model. You weren't supposed to do that.",
      "Opponent is probably uninstalling right now.",
    ],
    buttonText: "TOO EASY",
  } as SigintDialogue,

  research_halfway: {
    lines: [
      "15 classifications. Halfway through the research protocol.",
      "Your data is already contributing to real threat intelligence.",
      "15 more and you unlock everything. Keep pushing.",
    ],
    buttonText: "HALFWAY THERE",
  } as SigintDialogue,
};

// ── Page visit dialogues ──

export const PAGE_VISITS = {
  first_pvp_open: {
    lines: [
      "So you found the war room.",
      "Ranked matches. 5 emails each. First wrong answer and you're out.",
      "Your rank goes up when you win, down when you lose. Simple math.",
      "Queue up when you're ready. I'll find you an opponent.",
    ],
    buttonText: "UNDERSTOOD",
  } as SigintDialogue,

  first_inventory: {
    lines: [
      "Welcome to your locker.",
      "Themes change the whole terminal aesthetic. Badges go on your shelf — opponents see them in PvP.",
      "Cosmetics only. Nothing here makes you better. That part's on you.",
    ],
    buttonText: "GOT IT",
  } as SigintDialogue,

  first_profile: {
    lines: [
      "Your dossier.",
      "Stats, quests, friends — it's all here. The badges on your shelf show up in PvP lobbies.",
      "Try not to stare at your own win rate too long.",
    ],
    buttonText: "NOTED",
  } as SigintDialogue,

  first_shop: {
    lines: [
      "Shop's not open yet. Season 1.",
      "Coins, exclusive cosmetics, limited-time drops. The works.",
      "For now, enjoy the free stuff. You'll miss it when it's gone.",
    ],
    buttonText: "CAN'T WAIT",
  } as SigintDialogue,
};

// ── All dialogues combined for lookup ──

export const ALL_DIALOGUES: Record<string, SigintDialogue> = {
  ...ONBOARDING,
  ...MILESTONES,
  ...PAGE_VISITS,
};
