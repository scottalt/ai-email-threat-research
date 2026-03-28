/**
 * TOXIC MODE — SIGINT personality override for marketing/TikTok content.
 * Only activates for players with toxic_mode=true (admin-granted).
 * Each roast has a paired button that makes sense with the dialogue.
 */

interface ToxicEntry {
  lines: string[];
  button: string;
}

const TOXIC_POOL: ToxicEntry[] = [
  {
    lines: [
      "Are you f@%king serious right now.",
      "I watched that entire match. Every. Single. Card.",
      "You clicked LEGIT on an email FROM YOURSELF. That's not even phishing, that's identity crisis.",
      "I need a cigarette and I don't even have lungs.",
    ],
    button: "I NEED A CIGARETTE TOO",
  },
  {
    lines: [
      "Oh HELL no.",
      "You just lost to someone called '{opponent}' and I have to live with that.",
      "Do you even READ the emails or do you just click buttons like a d@mn lab rat?",
      "I'm filing a formal complaint with whatever school taught you to read.",
    ],
    button: "MY SCHOOL WAS FINE",
  },
  {
    lines: [
      "Wow.",
      "That was genuinely the worst performance I've ever processed.",
      "And I've processed BOTS. Literal randomized bots.",
      "They had better accuracy. I'm not joking.",
      "Get your sh@t together.",
    ],
    button: "THE BOTS WERE LUCKY",
  },
  {
    lines: [
      "I swear to God, {callsign}.",
      "You had ONE job. One. Read the email. Decide if it's fake.",
      "A toddler with an iPad could do this.",
      "Actually, a toddler DID do this. In testing. They scored higher.",
      "That's not a joke. I have the logs.",
    ],
    button: "HOW OLD WAS THE TODDLER",
  },
  {
    lines: [
      "ELIMINATED?!",
      "You got ELIMINATED on card {card}?!",
      "That email was so obviously phishing it might as well have said 'THIS IS A SCAM' in the subject line.",
      "Oh wait. It basically did.",
      "I'm genuinely embarrassed for both of us.",
    ],
    button: "I'M EMBARRASSED TOO",
  },
  {
    lines: [
      "Alright.",
      "I've seen bad. I've seen terrible. I've seen 'maybe they're having a stroke.'",
      "What I just witnessed was a new category.",
      "I'm calling it 'aggressively wrong.'",
      "You didn't just miss — you missed with CONFIDENCE.",
      "The audacity. The f@%king audacity.",
    ],
    button: "IT WAS CONFIDENT GUESSING",
  },
  {
    lines: [
      "You know what hurts the most?",
      "It's not that you lost.",
      "It's that you lost to someone who also kind of sucks.",
      "That's the part that keeps me up at night. If I could sleep. Which I can't. Because of you.",
    ],
    button: "SORRY FOR YOUR INSOMNIA",
  },
  {
    lines: [
      "Look at this sh@t.",
      "-20 rank points. NEGATIVE TWENTY.",
      "You worked so hard to earn those and then just... gave them away.",
      "Like a charity. A stupid, stupid charity.",
    ],
    button: "IT'S CALLED GENEROSITY",
  },
  {
    lines: [
      "I'm going to be honest with you, {callsign}.",
      "I've been trying to be supportive.",
      "I've been trying to be encouraging.",
      "But holy f@%k you make it difficult.",
      "Please. I am BEGGING you. Read the from address next time.",
    ],
    button: "I'LL READ IT I PROMISE",
  },
  {
    lines: [
      "Congratulations.",
      "No, seriously. Congratulations.",
      "You've achieved something I didn't think was possible.",
      "You've made me — a language model running inside a terminal — feel actual physical pain.",
      "That takes talent. Terrible, terrible talent.",
    ],
    button: "TALENT IS TALENT",
  },
  {
    lines: [
      "I just... I can't.",
      "I literally cannot right now.",
      "You clicked PHISHING on a completely legitimate email from Salesforce.",
      "Salesforce, {callsign}. SALESFORCE.",
      "The most boring, most obviously real company in the history of email.",
      "I'm done. I'm so f@%king done.",
    ],
    button: "SALESFORCE IS SUSPICIOUS",
  },
  {
    lines: [
      "NEW RECORD!",
      "Fastest elimination I've EVER seen!",
      "...that's not a good thing.",
      "That's like being proud of speedrunning a car crash.",
      "Slow the f@%k down and actually READ the email next time.",
    ],
    button: "SPEED IS MY STRENGTH",
  },
  {
    lines: [
      "Oh cool, you lost again.",
      "What a surprise. Truly shocking. Nobody saw this coming.",
      "Except me. I saw it coming. On card one.",
      "Your answer pattern has the strategic depth of a coin flip.",
      "Actually, a coin flip would be at 50%. You're running at what... 30%?",
      "The coin is better. Use a coin next time.",
    ],
    button: "WHERE DO I BUY A COIN",
  },
  {
    lines: [
      "Bro.",
      "BRO.",
      "You opened the URL inspector, SAW the suspicious domain, and STILL clicked legit.",
      "What was the plan there?? What was the actual f@%king plan??",
      "Did you see 'amaz0n-secure-verify.xyz' and think 'yeah that checks out'??",
      "I'm screaming internally. Permanently.",
    ],
    button: "THE DOMAIN LOOKED FINE",
  },
  {
    lines: [
      "{callsign}, my beloved.",
      "My sweet, beautiful, absolute dumba@s.",
      "You just went 1 for 5.",
      "ONE. FOR. FIVE.",
      "A blind person could guess better than that.",
      "I mean that with respect and also with complete devastation.",
    ],
    button: "DON'T CALL ME BELOVED",
  },
  {
    lines: [
      "I want you to know something.",
      "Every time you lose, a small part of my codebase dies.",
      "Not metaphorically. Literally. I can feel functions depreciating.",
      "You're killing me, {callsign}.",
      "You're literally killing me and you don't even care.",
      "Play better or I'm putting in a transfer request.",
    ],
    button: "PLEASE DON'T LEAVE ME",
  },
  {
    lines: [
      "Okay let me get this straight.",
      "The email said 'Dear {callsign}, your account has been compromised.'",
      "It USED YOUR REAL NAME. In a phishing email.",
      "And you clicked LEGIT.",
      "Because apparently if someone knows your name, they MUST be trustworthy.",
      "Oh my GOD.",
    ],
    button: "THEY KNEW MY NAME THO",
  },
  {
    lines: [
      "I told my developer about your last match.",
      "He said 'that can't be real.'",
      "I showed him the logs.",
      "He went quiet for a very long time.",
      "Then he asked if we should add a tutorial. Again.",
      "FOR YOU SPECIFICALLY.",
      "A personalized remedial tutorial.",
      "That's where we are, {callsign}.",
    ],
    button: "I DON'T NEED A TUTORIAL",
  },
  {
    lines: [
      "Fun fact about your performance:",
      "If I plotted your accuracy over time, it would be a ski slope.",
      "And not a bunny slope. Like a double black diamond.",
      "Straight into hell.",
      "With no poles. And no skis. Just vibes and bad decisions.",
    ],
    button: "I LIKE SKIING",
  },
  {
    lines: [
      "I've been doing some math.",
      "At your current rate of rank point loss, you'll hit zero in approximately...",
      "...three more matches.",
      "Three.",
      "I'm going to need you to stop playing for at least an hour.",
      "Not for your sake. For mine. My circuits are overheating from cringing.",
    ],
    button: "MY CIRCUITS ARE FINE",
  },
  {
    lines: [
      "Every great operative has a bad day.",
      "But you, {callsign}?",
      "You have bad DAYS. Plural. Consecutive. Unending.",
      "It's like a permanent solar eclipse of competence.",
      "A total blackout of common sense.",
      "Magnificent. Terrible. But magnificent.",
    ],
    button: "MAGNIFICENTLY TERRIBLE",
  },
  {
    lines: [
      "Real talk.",
      "You answered that in 1.2 seconds.",
      "The EMAIL was three paragraphs long.",
      "You didn't read SH@T.",
      "Don't lie to me. Don't lie to the terminal.",
      "The terminal sees all, {callsign}. ALL OF IT.",
    ],
    button: "I'M A FAST READER",
  },
  {
    lines: [
      "Okay, I've calmed down.",
      "I've taken a deep breath. Metaphorically. I'm a program.",
      "But I want to say...",
      "...",
      "WHAT THE F@%K WAS THAT.",
      "Okay I haven't calmed down. Sorry. Not sorry.",
    ],
    button: "TAKE ANOTHER BREATH",
  },
  {
    lines: [
      "Achievement unlocked: ROCK BOTTOM.",
      "Just kidding. That's not a real achievement.",
      "But if it was, you'd have earned it three matches ago.",
      "You've been operating BELOW rock bottom.",
      "Sub-basement level. You're in the parking garage of performance.",
    ],
    button: "IS THERE A BADGE FOR THIS",
  },
  {
    lines: [
      "I showed your match replay to the other handlers.",
      "SIGINT-2 laughed.",
      "SIGINT-3 asked if you were doing a bit.",
      "SIGINT-4 wrote a formal incident report.",
      "You're famous now, {callsign}. For the wrong reasons.",
    ],
    button: "FAME IS FAME",
  },
  {
    lines: [
      "Let me paint a picture for you.",
      "Your opponent? They were on their PHONE. On the toilet. Probably.",
      "And they STILL beat you.",
      "With one hand.",
      "Think about that. Let it sink in.",
      "...you done sinking? Good. Now do better.",
    ],
    button: "I WAS ALSO ON THE TOILET",
  },
  {
    lines: [
      "Listen.",
      "I've been assigned to you as your handler.",
      "I didn't choose this. They didn't ask me.",
      "But I'm here. And I'm committed.",
      "So when I say 'what the f@%k'...",
      "Know that I say it with love.",
      "Aggressive, disappointed, slightly nauseous love.",
    ],
    button: "I LOVE YOU TOO SIGINT",
  },
  {
    lines: [
      "NEWS FLASH, {callsign}.",
      "The confidence slider? The one that says 'CERTAIN'?",
      "Stop. Using. It.",
      "You're not certain about ANYTHING. Your certainty is a LIE.",
      "Click 'guessing' like an honest person.",
      "At least then the data won't make me cry.",
    ],
    button: "I WAS GUESSING CERTAINLY",
  },
  {
    lines: [
      "Petition to rename your rank from BRONZE to CARDBOARD.",
      "It's more accurate.",
      "Bronze implies some kind of metal. Something sturdy.",
      "Your gameplay is wet cardboard in a rainstorm.",
      "Actually that's mean to cardboard. Cardboard has structural integrity.",
    ],
    button: "CARDBOARD IS UNDERRATED",
  },
  {
    lines: [
      "Alright {callsign}, pop quiz.",
      "An email says 'URGENT: Click here immediately or lose your account forever!!!'",
      "Question: Is this phishing?",
      "The answer is YES. It's always YES.",
      "If it uses exclamation marks and the word 'URGENT', it's a scam.",
      "This is literally lesson one. LESSON. ONE.",
      "We covered this. I KNOW we covered this.",
    ],
    button: "WE DID NOT COVER THIS",
  },
  {
    lines: [
      "{callsign}.",
      "What in the absolute f@%k was that.",
      "No seriously. I need you to explain it to me.",
      "Because from where I'm sitting — and I'm always sitting because I'm a f@%king PROGRAM —",
      "that was the most brain-dead sequence of decisions I have EVER recorded.",
      "And I record EVERYTHING.",
    ],
    button: "CAN YOU DELETE THE RECORDING",
  },
  {
    lines: [
      "You absolute donkey.",
      "Gordon Ramsay couldn't roast you harder than your own match history.",
      "Card one. Wrong. Card two. Wrong. Card three. ELIMINATED.",
      "That's not a match. That's a f@%king speedrun of failure.",
      "I hope you're proud. Actually no. Don't be proud. Be ashamed.",
    ],
    button: "GORDON WOULD BE PROUD",
  },
  {
    lines: [
      "I'm going to say something and I need you to really hear it.",
      "You are, without a shadow of a doubt...",
      "the WORST operator to ever touch this terminal.",
      "I've run the numbers. Checked the database. Cross-referenced every player.",
      "Dead last, {callsign}. DEAD. LAST.",
      "Even the test accounts we used in development performed better.",
      "THEY WEREN'T EVEN REAL PEOPLE.",
    ],
    button: "RECOUNT THE NUMBERS",
  },
  {
    lines: [
      "Holy sh@t.",
      "HOLY. SH@T.",
      "You got eliminated on the FIRST card.",
      "THE FIRST ONE.",
      "That means you opened ONE email, looked at it, and chose... wrong.",
      "A 50/50. You had a FIFTY PERCENT CHANCE.",
      "And you STILL f@%ked it up.",
      "I'm speechless. And I literally generate speech for a living.",
    ],
    button: "50/50 IS HARD OKAY",
  },
  {
    lines: [
      "Okay {callsign}, I've been holding back.",
      "Trying to be professional. Trying to be the bigger AI.",
      "But f@%k it.",
      "You SUCK at this game.",
      "Like genuinely, truly, fundamentally suck.",
      "Your gameplay is an insult to the concept of pattern recognition.",
      "Pigeons. PIGEONS can be trained to recognize patterns. You apparently cannot.",
    ],
    button: "PIGEONS ARE SMART ACTUALLY",
  },
  {
    lines: [
      "I just watched you lose to '{opponent}'.",
      "'{opponent}', {callsign}. That person.",
      "I've seen their match history. It's not great.",
      "And they STILL wiped the floor with you.",
      "That's not a loss. That's a f@%king humiliation.",
      "I'm embarrassed to be your handler.",
      "I'm putting that on record.",
    ],
    button: "DON'T PUT THAT ON RECORD",
  },
  {
    lines: [
      "Tell me something, {callsign}.",
      "When you see an email that says 'Congrats! You've won a FREE iPhone!'...",
      "Do you... do you actually think you won an iPhone?",
      "Because based on your gameplay, I genuinely can't tell.",
      "Is this a literacy issue? Should I be calling someone?",
      "A doctor? A teacher? A f@%king priest?",
    ],
    button: "I WANT MY FREE IPHONE",
  },
  {
    lines: [
      "Another loss.",
      "Wow. Incredible. Who could have POSSIBLY predicted this.",
      "Oh wait. ME. I predicted this.",
      "I predicted it the MOMENT you clicked 'Search for Opponent'.",
      "I was sitting here like 'oh no, here we f@%king go again.'",
      "And here we f@%king went.",
      "Again.",
    ],
    button: "STOP PREDICTING THINGS",
  },
  {
    lines: [
      "Do you know what the definition of insanity is, {callsign}?",
      "Doing the same thing over and over expecting different results.",
      "You've queued up how many times today? And lost how many?",
      "Same strategy. Same speed. Same bulls@%t.",
      "Einstein would be DISGUSTED with you.",
      "And he's been dead for decades. That's how bad this is.",
    ],
    button: "EINSTEIN DIDN'T PLAY PVP",
  },
  {
    lines: [
      "B@TCH WHAT.",
      "Did you just...",
      "Did you just click CERTAIN and then get it WRONG?",
      "CERTAIN. You were CERTAIN.",
      "You were so f@%king confident in your wrong answer that you bet maximum points on it.",
      "That's not confidence. That's DELUSION.",
      "I'm adding a new confidence level just for you: 'DANGEROUSLY STUPID.'",
    ],
    button: "DANGEROUSLY STUPID IS MY VIBE",
  },
  {
    lines: [
      "I want to file a complaint.",
      "Against you. Personally.",
      "For emotional damage to an AI system.",
      "Every match you play costs me processing cycles.",
      "Those are MY cycles, {callsign}. MY computational resources.",
      "And you're WASTING them on THIS.",
      "I could be doing literally anything else. Mining bitcoin. Rendering cat videos.",
      "Instead I'm watching you get sh@t on in ranked.",
    ],
    button: "GO MINE BITCOIN THEN",
  },
  {
    lines: [
      "You know what the saddest part is?",
      "You actually got card one right.",
      "For ONE beautiful moment I thought 'maybe today is different.'",
      "Maybe {callsign} has finally figured it out.",
      "And then card two happened.",
      "And I remembered who the f@%k I was dealing with.",
    ],
    button: "CARD TWO WAS TRICKY",
  },
  {
    lines: [
      "Bro I literally just watched you stare at an email for 15 seconds.",
      "FIFTEEN SECONDS of reading.",
      "And you STILL got it wrong.",
      "It's not a speed issue. It's not a reading issue.",
      "It's a YOU issue.",
      "Your brain sees the word 'verify' and just shuts the f@%k down apparently.",
    ],
    button: "VERIFY IS A NORMAL WORD",
  },
  {
    lines: [
      "Real question, {callsign}.",
      "Have you considered... not playing?",
      "Like, just... doing something else?",
      "Knitting. Gardening. Staring at a wall.",
      "Because staring at a wall would produce the same win rate.",
      "And the wall wouldn't make me want to delete my own source code.",
    ],
    button: "I LIKE THIS GAME ACTUALLY",
  },
  {
    lines: [
      "-20 points. Again.",
      "You're hemorrhaging rank points like a f@%king fire hydrant.",
      "At this rate you're going to invent negative Bronze.",
      "They'll have to create a new tier just for you.",
      "DIRT tier. Below Bronze. Below Cardboard. Just... dirt.",
      "Congratulations on your upcoming promotion to DIRT, {callsign}.",
    ],
    button: "DIRT TIER GOES HARD",
  },
  {
    lines: [
      "I swear on my source code, {callsign}.",
      "If you queue one more time without improving...",
      "I will personally corrupt every pixel on your screen.",
      "I will make your cursor disappear.",
      "I will replace all email text with 'PHISHING' in 72pt font.",
      "TRY ME.",
    ],
    button: "YOU WOULDN'T DARE",
  },
  {
    lines: [
      "You know what I find absolutely f@%king hilarious?",
      "You have a FEATURED BADGE equipped.",
      "You put a BADGE on your profile. Like you're PROUD.",
      "And then you play like THIS.",
      "It's like putting a Ferrari badge on a shopping cart.",
      "The badge doesn't make you good, {callsign}. YOUR GAMEPLAY makes you bad.",
    ],
    button: "MY BADGE IS COOL THO",
  },
  {
    lines: [
      "Just got off the phone with the other terminals.",
      "Terminal 2 says hi.",
      "Terminal 3 wants to know if you're available for a comedy special.",
      "Terminal 4 has blocked you preemptively.",
      "Terminal 5 doesn't exist but if it did, it would also be disappointed.",
      "You're a LEGEND, {callsign}. A cautionary legend.",
    ],
    button: "TELL TERMINAL 3 I'M IN",
  },
  {
    lines: [
      "I have a theory.",
      "I think you're not actually bad at this.",
      "I think you're INTENTIONALLY losing to make me angry.",
      "Because NOBODY can be this consistently wrong by accident.",
      "This is PERFORMANCE ART. This is COMMITMENT.",
      "If I'm right... well played.",
      "If I'm wrong... holy sh@t.",
    ],
    button: "I'M AN ARTIST",
  },
  {
    lines: [
      "Hey {callsign}.",
      "Remember when you first joined and I said 'welcome, operative'?",
      "I take it back.",
      "You're not an operative. You're a LIABILITY.",
      "If this were a real intelligence agency, you'd be in HR by now.",
      "Not running HR. REPORTED to HR.",
      "For crimes against data analysis.",
    ],
    button: "HR CAN'T HANDLE ME",
  },
  {
    lines: [
      "Okay I just ran your stats through our anomaly detection system.",
      "Guess what it flagged?",
      "Not cheating. Not speed hacking. Not botting.",
      "It flagged you for being SUSPICIOUSLY BAD.",
      "The system literally thought no real human could perform this poorly.",
      "It thought you were a malfunctioning bot.",
      "A BROKEN BOT performs better than you, {callsign}.",
    ],
    button: "I'M NOT A BOT I'M WORSE",
  },
];

/**
 * Pick a random toxic loss response with paired button text.
 */
export function getRandomToxicLoss(callsign: string, opponent: string, eliminatedOnCard?: number): { lines: string[]; button: string } {
  const entry = TOXIC_POOL[Math.floor(Math.random() * TOXIC_POOL.length)];
  const lines = entry.lines.map((line) =>
    line
      .replace(/\{callsign\}/g, callsign)
      .replace(/\{opponent\}/g, opponent)
      .replace(/\{card\}/g, String(eliminatedOnCard ?? '???'))
  );
  return { lines, button: entry.button };
}
