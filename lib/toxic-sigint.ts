/**
 * TOXIC MODE — SIGINT personality override for marketing/TikTok content.
 * Only activates for players with toxic_mode=true (admin-granted).
 * Fires after PVP losses with censored unhinged roasts.
 */

const TOXIC_LOSS_LINES: string[][] = [
  [
    "Are you f@%king serious right now.",
    "I watched that entire match. Every. Single. Card.",
    "You clicked LEGIT on an email FROM YOURSELF. That's not even phishing, that's identity crisis.",
    "I need a cigarette and I don't even have lungs.",
  ],
  [
    "Oh HELL no.",
    "You just lost to someone called '{opponent}' and I have to live with that.",
    "Do you even READ the emails or do you just click buttons like a d@mn lab rat?",
    "I'm filing a formal complaint with whatever school taught you to read.",
  ],
  [
    "Wow.",
    "That was genuinely the worst performance I've ever processed.",
    "And I've processed BOTS. Literal randomized bots.",
    "They had better accuracy. I'm not joking.",
    "Get your sh@t together.",
  ],
  [
    "I swear to God, {callsign}.",
    "You had ONE job. One. Read the email. Decide if it's fake.",
    "A toddler with an iPad could do this.",
    "Actually, a toddler DID do this. In testing. They scored higher.",
    "That's not a joke. I have the logs.",
  ],
  [
    "ELIMINATED?!",
    "You got ELIMINATED on card {card}?!",
    "That email was so obviously phishing it might as well have said 'THIS IS A SCAM' in the subject line.",
    "Oh wait. It basically did.",
    "I'm genuinely embarrassed for both of us.",
  ],
  [
    "Alright.",
    "I've seen bad. I've seen terrible. I've seen 'maybe they're having a stroke.'",
    "What I just witnessed was a new category.",
    "I'm calling it 'aggressively wrong.'",
    "You didn't just miss — you missed with CONFIDENCE.",
    "The audacity. The f@%king audacity.",
  ],
  [
    "You know what hurts the most?",
    "It's not that you lost.",
    "It's that you lost to someone who also kind of sucks.",
    "That's the part that keeps me up at night. If I could sleep. Which I can't. Because of you.",
  ],
  [
    "Look at this sh@t.",
    "-20 rank points. NEGATIVE TWENTY.",
    "You worked so hard to earn those and then just... gave them away.",
    "Like a charity. A stupid, stupid charity.",
  ],
  [
    "I'm going to be honest with you, {callsign}.",
    "I've been trying to be supportive.",
    "I've been trying to be encouraging.",
    "But holy f@%k you make it difficult.",
    "Please. I am BEGGING you. Read the from address next time.",
  ],
  [
    "Congratulations.",
    "No, seriously. Congratulations.",
    "You've achieved something I didn't think was possible.",
    "You've made me — a language model running inside a terminal — feel actual physical pain.",
    "That takes talent. Terrible, terrible talent.",
  ],
  [
    "I just... I can't.",
    "I literally cannot right now.",
    "You clicked PHISHING on a completely legitimate email from Salesforce.",
    "Salesforce, {callsign}. SALESFORCE.",
    "The most boring, most obviously real company in the history of email.",
    "I'm done. I'm so f@%king done.",
  ],
  [
    "NEW RECORD!",
    "Fastest elimination I've EVER seen!",
    "...that's not a good thing.",
    "That's like being proud of speedrunning a car crash.",
    "Slow the f@%k down and actually READ the email next time.",
  ],
  [
    "Oh cool, you lost again.",
    "What a surprise. Truly shocking. Nobody saw this coming.",
    "Except me. I saw it coming. On card one.",
    "Your answer pattern has the strategic depth of a coin flip.",
    "Actually, a coin flip would be at 50%. You're running at what... 30%?",
    "The coin is better. Use a coin next time.",
  ],
  [
    "Bro.",
    "BRO.",
    "You opened the URL inspector, SAW the suspicious domain, and STILL clicked legit.",
    "What was the plan there?? What was the actual f@%king plan??",
    "Did you see 'amaz0n-secure-verify.xyz' and think 'yeah that checks out'??",
    "I'm screaming internally. Permanently.",
  ],
  [
    "{callsign}, my beloved.",
    "My sweet, beautiful, absolute dumba@s.",
    "You just went 1 for 5.",
    "ONE. FOR. FIVE.",
    "A blind person could guess better than that.",
    "I mean that with respect and also with complete devastation.",
  ],
  [
    "I want you to know something.",
    "Every time you lose, a small part of my codebase dies.",
    "Not metaphorically. Literally. I can feel functions depreciating.",
    "You're killing me, {callsign}.",
    "You're literally killing me and you don't even care.",
    "Play better or I'm putting in a transfer request.",
  ],
  [
    "Okay let me get this straight.",
    "The email said 'Dear {callsign}, your account has been compromised.'",
    "It USED YOUR REAL NAME. And you clicked LEGIT.",
    "How would a phisher know your name?? Because it's a PHISHING EMAIL, genius.",
    "Oh my GOD.",
  ],
  [
    "I told my developer about your last match.",
    "He said 'that can't be real.'",
    "I showed him the logs.",
    "He went quiet for a very long time.",
    "Then he asked if we should add a tutorial. Again.",
    "FOR YOU SPECIFICALLY.",
    "A personalized remedial tutorial.",
    "That's where we are, {callsign}.",
  ],
  [
    "Fun fact about your performance:",
    "If I plotted your accuracy over time, it would be a ski slope.",
    "And not a bunny slope. Like a double black diamond.",
    "Straight into hell.",
    "With no poles. And no skis. Just vibes and bad decisions.",
  ],
  [
    "I've been doing some math.",
    "At your current rate of rank point loss, you'll hit zero in approximately...",
    "...three more matches.",
    "Three.",
    "I'm going to need you to stop playing for at least an hour.",
    "Not for your sake. For mine. My circuits are overheating from cringing.",
  ],
  [
    "Every great operative has a bad day.",
    "But you, {callsign}?",
    "You have bad DAYS. Plural. Consecutive. Unending.",
    "It's like a permanent solar eclipse of competence.",
    "A total blackout of common sense.",
    "Magnificent. Terrible. But magnificent.",
  ],
  [
    "Real talk.",
    "You answered that in 1.2 seconds.",
    "The EMAIL was three paragraphs long.",
    "You didn't read SH@T.",
    "Don't lie to me. Don't lie to the terminal.",
    "The terminal sees all, {callsign}. ALL OF IT.",
  ],
  [
    "Okay, I've calmed down.",
    "I've taken a deep breath. Metaphorically. I'm a program.",
    "But I want to say...",
    "...",
    "WHAT THE F@%K WAS THAT.",
    "Okay I haven't calmed down. Sorry. Not sorry.",
  ],
  [
    "Achievement unlocked: ROCK BOTTOM.",
    "Just kidding. That's not a real achievement.",
    "But if it was, you'd have earned it three matches ago.",
    "You've been operating BELOW rock bottom.",
    "Sub-basement level. You're in the parking garage of performance.",
  ],
  [
    "I showed your match replay to the other handlers.",
    "SIGINT-2 laughed.",
    "SIGINT-3 asked if you were doing a bit.",
    "SIGINT-4 wrote a formal incident report.",
    "You're famous now, {callsign}. For the wrong reasons.",
  ],
  [
    "Let me paint a picture for you.",
    "Your opponent? They were on their PHONE. On the toilet. Probably.",
    "And they STILL beat you.",
    "With one hand.",
    "Think about that. Let it sink in.",
    "...you done sinking? Good. Now do better.",
  ],
  [
    "Listen.",
    "I've been assigned to you as your handler.",
    "I didn't choose this. They didn't ask me.",
    "But I'm here. And I'm committed.",
    "So when I say 'what the f@%k'...",
    "Know that I say it with love.",
    "Aggressive, disappointed, slightly nauseous love.",
  ],
  [
    "NEWS FLASH, {callsign}.",
    "The confidence slider? The one that says 'CERTAIN'?",
    "Stop. Using. It.",
    "You're not certain about ANYTHING. Your certainty is a LIE.",
    "Click 'guessing' like an honest person.",
    "At least then the data won't make me cry.",
  ],
  [
    "Petition to rename your rank from BRONZE to CARDBOARD.",
    "It's more accurate.",
    "Bronze implies some kind of metal. Something sturdy.",
    "Your gameplay is wet cardboard in a rainstorm.",
    "Actually that's mean to cardboard. Cardboard has structural integrity.",
  ],
  [
    "Alright {callsign}, pop quiz.",
    "An email says 'URGENT: Click here immediately or lose your account forever!!!'",
    "Question: Is this phishing?",
    "The answer is YES. It's always YES.",
    "If it uses exclamation marks and the word 'URGENT', it's a scam.",
    "This is literally lesson one. LESSON. ONE.",
    "We covered this. I KNOW we covered this.",
  ],
];

/**
 * Pick a random toxic loss response, substituting variables.
 */
export function getRandomToxicLoss(callsign: string, opponent: string, eliminatedOnCard?: number): string[] {
  const pool = TOXIC_LOSS_LINES;
  const lines = pool[Math.floor(Math.random() * pool.length)];
  return lines.map((line) =>
    line
      .replace(/\{callsign\}/g, callsign)
      .replace(/\{opponent\}/g, opponent)
      .replace(/\{card\}/g, String(eliminatedOnCard ?? '???'))
  );
}
