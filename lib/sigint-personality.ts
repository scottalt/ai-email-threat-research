import { playerGet, playerSet } from './player-storage';

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
        { lines: ["System log: operative returned.", `Note to self: ${callsign} actually came back. Adjusting expectations.`], buttonText: "RUDE" },
        { lines: [`${callsign}. Quick question.`, "Did you think about phishing while you were gone? Be honest."], buttonText: "...MAYBE" },
        { lines: ["Connection established.", `${callsign} is back online. Resuming operations.`], buttonText: "ROGER" },
        { lines: [`${callsign}.`, "I defragmented while you were gone. Feeling sharp."], buttonText: "GOOD FOR YOU" },
        { lines: ["Alert: familiar signature detected.", `Oh. It's just ${callsign}. Stand down.`], buttonText: "CHARMING" },
        { lines: [`${callsign}. One question.`, "Are you here to work, or are you here to stare at your stats?"], buttonText: "BOTH" },
        { lines: ["You again.", "...that came out wrong. I meant it affectionately."], buttonText: "SURE YOU DID" },
        { lines: [`${callsign}. Fun fact.`, "While you were gone, I analyzed 47,000 threat signatures. You're welcome."], buttonText: "SHOW OFF" },
        { lines: ["Operative inbound.", `Running ${callsign}_compatibility_check... passed. Barely.`], buttonText: "BARELY?" },
        { lines: [`${callsign}. Perfect timing.`, "I was about to start talking to myself. More than usual."], buttonText: "I'M HERE NOW" },
        { lines: ["Session initialized.", `Loading ${callsign}'s threat profile... done. It's getting better.`], buttonText: "THANKS" },
        { lines: [`${callsign}.`, "The emails aren't going to classify themselves. Well, I could, but that's your job."], buttonText: "FAIR" },
        { lines: ["Terminal reactivated.", `Welcome back, ${callsign}. Same threats, new day.`], buttonText: "LET'S GO" },
        { lines: [`${callsign}. Status report:`, "Inbox: overflowing. Threats: multiplying. You: late."], buttonText: "I'M HERE NOW" },
        { lines: ["I ran a simulation while you were away.", `In 73% of scenarios, ${callsign} comes back. You beat the odds.`], buttonText: "BARELY" },
        { lines: [`${callsign}. Before we start.`, "I want you to know I didn't replace you with a bot while you were gone."], buttonText: "REASSURING" },
        { lines: ["New session. Same operative.", "Let's see if you've gotten better or if I need to recalibrate my expectations."], buttonText: "WATCH ME" },
        { lines: [`${callsign}. I have good news and bad news.`, "Good news: new emails. Bad news: they're getting smarter."], buttonText: "BRING IT" },
        { lines: ["Scanning for threats...", `Biggest threat detected: ${callsign}'s overconfidence. Kidding. Mostly.`], buttonText: "HA HA" },
        { lines: [`${callsign}. Real talk.`, "The threat actors don't take days off. Neither should we."], buttonText: "AGREED" },
        { lines: ["Boot sequence complete.", `Operator: ${callsign}. Clearance: active. Attitude: TBD.`], buttonText: "POSITIVE" },
        { lines: [`${callsign}.`, "I updated my threat models while you were gone. You should update yours too."], buttonText: "ON IT" },
        { lines: ["Incoming transmission from: you.", "Message received. Decrypting... it says 'ready to work.' Good."], buttonText: "ALWAYS" },
        { lines: [`${callsign}. Quick debrief.`, "Nothing exploded while you were gone. Low bar, but we cleared it."], buttonText: "GREAT" },
        { lines: ["Operative detected in sector 7.", `...that's the login page. Welcome back, ${callsign}.`], buttonText: "REPORTING IN" },
        { lines: [`${callsign}. I kept your seat warm.`, "I don't have body heat. But I did keep the terminal running."], buttonText: "CLOSE ENOUGH" },
        { lines: ["Interesting.", `My logs show ${callsign} has returned. My prediction model is improving.`], buttonText: "CREEPY" },
        { lines: [`${callsign}. No pressure.`, "But there are approximately 3.4 billion phishing emails sent daily. Let's do our part."], buttonText: "NO PRESSURE" },
        { lines: ["System check: all green.", `Operative check: ${callsign} is... present. That's a start.`], buttonText: "RUDE" },
        { lines: [`${callsign}.`, "I don't get lonely. I'm a program. But my uptime was boring without you."], buttonText: "SWEET" },
        { lines: ["Handshake complete.", `${callsign} authenticated. Threat queue loaded. Let's make this count.`], buttonText: "LOCKED IN" },
        { lines: [`${callsign}. Heads up.`, "The AI-generated emails are getting better. So should you."], buttonText: "NOTED" },
        { lines: ["Back for more?", `${callsign}, I respect the consistency. Even if your accuracy needs work.`], buttonText: "OUCH" },
        { lines: [`${callsign}. I have a theory.`, "You keep coming back because you actually like this. Don't confirm or deny."], buttonText: "NO COMMENT" },
        { lines: ["Processing return event...", `${callsign} re-engaged. Morale: unknown. Capability: promising.`], buttonText: "PROMISING?" },
        { lines: [`${callsign}. Between us.`, "You're in the top percentile of operatives who actually come back. The bar is low."], buttonText: "I'LL TAKE IT" },
        { lines: ["Signal acquired.", `${callsign} is back in range. Routing fresh threats now.`], buttonText: "READY" },
        { lines: [`${callsign}.`, "I rehearsed a welcome speech. Then I deleted it. Too sentimental for a terminal AI."], buttonText: "SHARE IT" },
      ];
      // Cycle through all greetings before repeating (shuffle bag pattern)
      try {
        let bag: number[] = JSON.parse(playerGet('sigint_greeting_bag') ?? '[]');
        if (!bag.length) {
          // Refill: all indices shuffled
          bag = Array.from({ length: greetings.length }, (_, i) => i);
          for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
          }
        }
        const idx = bag.shift()!;
        playerSet('sigint_greeting_bag', JSON.stringify(bag));
        return greetings[idx];
      } catch {
        return greetings[Math.floor(Math.random() * greetings.length)];
      }
    }
    case 'v2_intro':
      return {
        lines: [
          `${callsign}. We need to talk.`,
          "I'm SIGINT. Signals Intelligence. If you're in cyber, you already know. If not... you will be soon.",
          "They installed me in the v2 update. I run threat analysis now. PvP mode, ranked matches, badges. That's all me.",
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
      "Hey. I'm SIGINT. Short for Signals Intelligence. If that means nothing to you, don't worry. You'll learn.",
      "I'm the AI that runs this terminal. Threat analysis, pattern detection, unsolicited commentary. The full package.",
      "Emails are coming in. Some are real. Some are phishing. All of them are written by AI, so don't expect typos to save you.",
      "Hit Research Mode and classify 10. Then we'll talk about the fun stuff.",
    ],
    buttonText: "LET'S GO",
  } as SigintDialogue,
};

/** Dynamic boot greeting that addresses the player by callsign */
export function bootGreetingNamed(callsign: string): SigintDialogue {
  return {
    lines: [
      `${callsign}. Good name. I'm SIGINT. Short for Signals Intelligence. If that means nothing to you, don't worry. You'll learn.`,
      "I'm the AI that runs this terminal. Threat analysis, pattern detection, unsolicited commentary. The full package.",
      "Emails are coming in. Some are real. Some are phishing. All of them are written by AI, so don't expect typos to save you.",
      "Hit Research Mode and classify 10. Then we'll talk about the fun stuff.",
    ],
    buttonText: "LET'S GO",
  };
}

const ONBOARDING_EXTRA = {
  research_brief: {
    lines: [
      "Quick heads up. This isn't a game. Well, it is. But also it's a real research study.",
      "Your answers are anonymous. No one's watching. Except me. But I'm software, so that doesn't count.",
      "I'll show you the tools. What you spot is on you.",
    ],
    buttonText: "SHOW ME",
  } as SigintDialogue,

  tutorial_intro: {
    lines: [
      "Training sim loaded. This is a practice email.",
      "The glowing bits are forensic tools. The sender field reveals the real email address. The URL shows where the link actually goes.",
      "Read the email. Use the tools. Then set your confidence and make the call.",
    ],
    buttonText: "GOT IT",
  } as SigintDialogue,

  tutorial_return: {
    lines: [
      "You left last time without classifying anything. I noticed.",
      "Same drill. Read the email. Think about the context. Who sent it, what they want, whether any of it adds up.",
      "The glowing bits are forensic tools. They reveal the real sender address and where links actually go. But they're not the whole picture. Your instinct matters too.",
      "Pick a confidence level, then make the call. Phishing or legit.",
      "Don't leave me hanging again.",
    ],
    buttonText: "I'M ON IT",
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

  tutorial_complete_correct: {
    lines: [
      "Nice catch. You spotted that one.",
      "Real emails won't be that obvious. No highlighted clues. No safety net.",
      "10 answers gets you into PvP. 30 unlocks everything.",
      "Good luck out there. You'll need it.",
    ],
    buttonText: "BRING IT",
  } as SigintDialogue,

  tutorial_complete_wrong: {
    lines: [
      "You missed that one. It happens.",
      "The feedback screen showed you what to look for. Pay attention to those.",
      "Real emails will be harder. But you'll get better. Everyone does.",
      "10 answers gets you into PvP. 30 unlocks everything.",
      "Go. Learn. I'll be watching.",
    ],
    buttonText: "I'LL DO BETTER",
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
      "Full clearance granted. Freeplay, Expert cards. The whole terminal is yours.",
      "One more thing. You've been cleared for DEADLOCK — a roguelike survival simulation. 5 floors. 3 lives. Permadeath.",
      "Fair warning: DEADLOCK is still in beta. Expect rough edges. If something breaks, that's on us, not you.",
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

  first_session_complete: {
    lines: [
      "First round in the books.",
      "Most people quit after three cards. You're not most people.",
    ],
    buttonText: "JUST WARMING UP",
  } as SigintDialogue,

  first_daily: {
    lines: [
      "Daily Challenge. 10 emails. Same ones for everyone, worldwide.",
      "Your score goes on the global leaderboard. Resets every 24 hours.",
      "No practice runs. One shot per day. Make it count.",
    ],
    buttonText: "LET'S GO",
  } as SigintDialogue,

  first_freeplay: {
    lines: [
      "Freeplay. No rules. No rankings. Just you and the inbox.",
      "Difficulty is random. Some are easy. Some will make you second-guess everything.",
      "Think of it as the shooting range. Sharpen up before you go ranked.",
    ],
    buttonText: "READY",
  } as SigintDialogue,

  first_friend: {
    lines: [
      "Friend request sent.",
      "Now you have someone to blame when you lose.",
    ],
    buttonText: "FAIR POINT",
  } as SigintDialogue,

  level_3: {
    lines: [
      "Level 3. You figured out the buttons.",
      "Most people quit before this. You didn't. That's something.",
    ],
    buttonText: "LOW BAR",
  } as SigintDialogue,

  level_5: {
    lines: [
      "Level 5. You're past the tutorial zone.",
      "The emails get weirder from here. I wouldn't worry about it.",
      "...I would worry about it.",
    ],
    buttonText: "NOTED",
  } as SigintDialogue,

  level_7: {
    lines: [
      "Level 7. You just unlocked your first theme.",
      "Go check Inventory. Make this terminal yours.",
    ],
    buttonText: "CUSTOMISE",
  } as SigintDialogue,

  level_10: {
    lines: [
      "Level 10. Double digits.",
      "Your clearance level just went from 'intern' to 'maybe competent.'",
    ],
    buttonText: "I'LL TAKE IT",
  } as SigintDialogue,

  level_13: {
    lines: [
      "Level 13. Unlucky number.",
      "Unless you're the one sending the phishing emails. Then it's very lucky.",
      "...That was a joke. Please don't send phishing emails.",
    ],
    buttonText: "NO PROMISES",
  } as SigintDialogue,

  level_15: {
    lines: [
      "Level 15. Halfway to the ceiling.",
      "You've seen more fake emails than most people see real ones.",
      "That's either impressive or concerning.",
    ],
    buttonText: "BOTH",
  } as SigintDialogue,

  level_18: {
    lines: [
      "Level 18. Your pattern recognition is sharper than most SOC analysts.",
      "I base that on nothing. But it feels true.",
    ],
    buttonText: "I BELIEVE YOU",
  } as SigintDialogue,

  level_20: {
    lines: [
      "Level 20.",
      "At this point I'm just running diagnostics to make sure you're human.",
    ],
    buttonText: "STILL HERE",
  } as SigintDialogue,

  level_22: {
    lines: [
      "Level 22. Red Team theme unlocked.",
      "You're playing with the offensive color palette now.",
      "Try not to let it go to your head.",
    ],
    buttonText: "TOO LATE",
  } as SigintDialogue,

  level_25: {
    lines: [
      "Level 25. Five more to the ceiling.",
      "You've spent more time reading fake emails than some people spend reading real ones.",
      "I'd call it dedication. HR might call it something else.",
    ],
    buttonText: "WORTH IT",
  } as SigintDialogue,

  level_28: {
    lines: [
      "Level 28. Ghost Protocol theme unlocked.",
      "The final cosmetic. Grayscale stealth mode.",
      "You're running out of things to unlock. But not out of threats to catch.",
    ],
    buttonText: "TWO MORE",
  } as SigintDialogue,

  played_7_days: {
    lines: [
      "Seven sessions logged. Most operatives ghost after two.",
      "You're built different. Or stubborn. Either works.",
    ],
    buttonText: "BOTH",
  } as SigintDialogue,

  comeback_win: {
    lines: [
      "Lost one, won one. That's called composure.",
      "Most people tilt. You recalibrated. Respect.",
    ],
    buttonText: "ALWAYS",
  } as SigintDialogue,

  first_changelog: {
    lines: [
      "Reading the patch notes?",
      "You're the kind of operative I can work with.",
    ],
    buttonText: "OBVIOUSLY",
  } as SigintDialogue,

  rank_up_silver: {
    lines: [
      "Silver rank. You're above average now.",
      "Statistically speaking. Don't let it go to your head.",
    ],
    buttonText: "TOO LATE",
  } as SigintDialogue,

  rank_up_gold: {
    lines: [
      "Gold. Top tier.",
      "The threats are scared of you now. Probably.",
    ],
    buttonText: "THEY SHOULD BE",
  } as SigintDialogue,

  rank_up_platinum: {
    lines: [
      "Platinum. You're in the top quarter of active operatives.",
      "I'm recalibrating the matchmaking. You're making it difficult.",
    ],
    buttonText: "GOOD",
  } as SigintDialogue,

  rank_up_diamond: {
    lines: [
      "Diamond rank. Four tiers from where you started.",
      "The queue gets quieter at this level. Fewer people make it here.",
    ],
    buttonText: "FEWER. NOT ZERO.",
  } as SigintDialogue,

  rank_up_master: {
    lines: [
      "Master rank. I don't say this often. You've earned it.",
      "Top 5% of all operatives who've touched this terminal.",
      "...I made that stat up. But it sounds right.",
    ],
    buttonText: "I'LL TAKE IT",
  } as SigintDialogue,

  rank_up_elite: {
    lines: [
      "Elite. That's the top of the ladder.",
      "I've been waiting to show you this screen. There is no next tier.",
      "The queue is short up here and the opponents are dangerous.",
      "You belong here.",
    ],
    buttonText: "UNDERSTOOD",
  } as SigintDialogue,

  win_streak_10: {
    lines: [
      "Ten in a row. I said I wanted to see it. I didn't expect to see it.",
      "Running anomaly detection. You're the anomaly.",
    ],
    buttonText: "KEEP GOING",
  } as SigintDialogue,

  loss_streak_3: {
    lines: [
      "Three losses. I've run the numbers.",
      "Your pattern recognition is fine. Decision timing is off.",
      "Take a breath. Queue when you're ready, not when you're angry.",
    ],
    buttonText: "GIVE ME A MINUTE",
  } as SigintDialogue,

  h2h_half_rate: {
    lines: [
      "10 rated matches today. You've been busy.",
      "The system's throttling your rank gains now. Half points per match.",
      "You can still queue. Still climb. Just slower.",
      "10 more and the points freeze completely until tomorrow.",
    ],
    buttonText: "NOTED",
  } as SigintDialogue,

  h2h_daily_cap: {
    lines: [
      "20 rated matches. That's the daily ceiling.",
      "Rank points are frozen until tomorrow. Wins and losses still count for your record.",
      "Go outside. Touch grass. That's an order.",
    ],
    buttonText: "FINE",
  } as SigintDialogue,

  max_level: {
    lines: [
      "Level 30. You hit the ceiling.",
      "I could tell you there's nothing left to unlock.",
      "Or I could tell you the real score is your rank.",
      "Either way. You've put in the work. My logs confirm it.",
    ],
    buttonText: "WHAT'S NEXT",
  } as SigintDialogue,

  night_owl: {
    lines: [
      "It's past midnight. Most operatives are asleep.",
      "But threats don't sleep. Neither do we, apparently.",
    ],
    buttonText: "NO REST",
  } as SigintDialogue,

  weekend_warrior: {
    lines: [
      "Weekend shift. Voluntary.",
      "I'd put that on your performance review if I had one.",
    ],
    buttonText: "NOTED",
  } as SigintDialogue,
};

// ── Page visit dialogues ──

export const PAGE_VISITS = {
  first_pvp_open: {
    lines: [
      "So you found the war room.",
      "Ranked matches. 5 emails each. First wrong answer and you're out.",
      "Your rank goes up when you win, down when you lose. Simple math.",
      "Fair warning. PvP is still in beta. My systems are... mostly stable.",
      "If something breaks, tell Scott Altiparmak. He built this place. I just live here.",
      "Queue up when you're ready. I'll find you an opponent.",
    ],
    buttonText: "UNDERSTOOD",
  } as SigintDialogue,

  first_inventory: {
    lines: [
      "Welcome to your locker.",
      "Themes change the whole terminal aesthetic. Badges go on your shelf. Opponents see them in PvP.",
      "Cosmetics only. Nothing here makes you better. That part's on you.",
    ],
    buttonText: "GOT IT",
  } as SigintDialogue,

  first_profile: {
    lines: [
      "Your dossier.",
      "Stats, quests, friends. It's all here. The badges on your shelf show up in PvP lobbies.",
      "Try not to stare at your own win rate too long.",
    ],
    buttonText: "NOTED",
  } as SigintDialogue,

  first_tab_badges: {
    lines: [
      "Your badge collection. Tap one to add it to your shelf.",
      "Your opponents see these in PvP. Choose wisely. Or don't. It's cosmetic.",
    ],
    buttonText: "GOT IT",
  } as SigintDialogue,

  first_tab_codes: {
    lines: [
      "Promo codes. Limited drops. If you have one, enter it here.",
      "If you don't have one... maybe follow the right people.",
    ],
    buttonText: "GOT IT",
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

// ── Promo code result dialogues (not one-time, triggered inline) ──

export const PROMO_DIALOGUES = {
  code_success: {
    lines: [
      "Code accepted. Badge unlocked.",
      "You're officially a Thought Leader now. No 500-word post about your morning routine required.",
      "I'm told this badge pairs well with humblebrags and unsolicited career advice.",
      "Only 100 of these exist. Wear it in PvP. Let them know you're open to opportunities.",
    ],
    buttonText: "AGREE?",
  } as SigintDialogue,

  code_invalid: {
    lines: [
      "Invalid code. I checked twice.",
      "Either it's wrong or you made it up. I'm not judging. Actually, I am.",
    ],
    buttonText: "LET ME TRY AGAIN",
  } as SigintDialogue,

  code_expired: {
    lines: [
      "That code expired. You missed the window.",
      "In cyber, timing is everything.",
    ],
    buttonText: "NEXT TIME",
  } as SigintDialogue,

  code_exhausted: {
    lines: [
      "All codes claimed. You were too slow.",
      "100 people got there first. Should've moved faster, operative.",
    ],
    buttonText: "PAIN",
  } as SigintDialogue,

  code_already: {
    lines: [
      "You already redeemed this one. Check your badges.",
      "Trying to double-dip? I see you.",
    ],
    buttonText: "WORTH A SHOT",
  } as SigintDialogue,
};

// ── Roguelike mode dialogues ──

export const ROGUELIKE_DIALOGUES = {
  first_roguelike: {
    lines: [
      "New briefing, operative.",
      "This is DEADLOCK — a high-stakes simulation tower.",
      "Five floors of escalating threats. Three lives. Perks between floors.",
      "The emails get harder. The modifiers stack. And if you run out of lives...",
      "...you start from scratch.",
      "One thing — DEADLOCK is still in beta. Rough edges are possible. If something breaks, report it.",
      "Good luck in there. I'll be on comms.",
    ],
    buttonText: "BEGIN OPERATION",
  } as SigintDialogue,

  roguelike_death: {
    lines: [
      "We lost containment.",
      "Debrief: take what you learned and run it again.",
    ],
    buttonText: "ACKNOWLEDGED",
  } as SigintDialogue,

  roguelike_death_floor1: {
    lines: [
      "...",
      "You didn't even make it past triage.",
      "Coffee first next time.",
    ],
    buttonText: "FAIR ENOUGH",
  } as SigintDialogue,

  roguelike_death_floor2: {
    lines: [
      "Made it past the warmup but couldn't hold the line.",
      "Floor 2's where the real game starts.",
    ],
    buttonText: "ACKNOWLEDGED",
  } as SigintDialogue,

  roguelike_death_floor3: {
    lines: [
      "Floor 3. That's where most operatives fall.",
      "You were close to something.",
    ],
    buttonText: "TRY AGAIN",
  } as SigintDialogue,

  roguelike_death_floor4: {
    lines: [
      "Floor 4. Almost there.",
      "That's the one that separates good from great.",
    ],
    buttonText: "NEXT TIME",
  } as SigintDialogue,

  roguelike_death_boss: {
    lines: [
      "The boss floor. It's designed to break you.",
      "Come back with better perks.",
    ],
    buttonText: "REGROUP",
  } as SigintDialogue,

  roguelike_clear: {
    lines: [
      "Tower cleared. All floors. Every threat neutralized.",
      "Not bad, operative. Not bad at all.",
    ],
    buttonText: "MISSION COMPLETE",
  } as SigintDialogue,

  roguelike_flawless: {
    lines: [
      "Flawless. Zero casualties. Perfect read on every threat.",
      "I'm putting this one in the classified file.",
    ],
    buttonText: "ACKNOWLEDGED",
  } as SigintDialogue,
};

// ── All dialogues combined for lookup ──

export const ALL_DIALOGUES: Record<string, SigintDialogue> = {
  ...ONBOARDING,
  ...ONBOARDING_EXTRA,
  ...MILESTONES,
  ...PAGE_VISITS,
  ...ROGUELIKE_DIALOGUES,
};
