export interface Quest {
  id: string;
  name: string;
  description: string;
  detail: string; // longer explanation shown on the quest card
  target: number;
  reward: string;
  xpReward: number;
  icon: string;
}

export const QUESTS: Quest[] = [
  {
    id: 'unlock_pvp',
    name: 'PROVE YOURSELF',
    description: 'Complete 10 research analyses to qualify for ranked PvP',
    detail: 'Read each email carefully and decide: is it phishing or legitimate? Your answers contribute to real security research measuring which phishing techniques humans miss when AI writes the email. Complete 10 to unlock 1v1 ranked PvP matches.',
    target: 10,
    reward: 'PvP MODE UNLOCKED',
    xpReward: 100,
    icon: '⚔',
  },
  {
    id: 'unlock_daily',
    name: 'RISING ANALYST',
    description: 'Complete 20 research analyses to access daily challenges',
    detail: 'Keep contributing to the research dataset. Every answer helps build a baseline for how humans detect phishing in the age of AI-generated emails. Complete 20 to unlock the Daily Challenge — a new set of cards every day with a global leaderboard.',
    target: 20,
    reward: 'DAILY CHALLENGE UNLOCKED',
    xpReward: 200,
    icon: '📅',
  },
  {
    id: 'unlock_freeplay',
    name: 'FULL CLEARANCE',
    description: 'Complete all 30 research analyses for unrestricted access',
    detail: 'Finish your full contribution to the research study. 30 answers across 3 sessions gives us statistically meaningful data from your perspective. Complete all 30 to unlock Freeplay — unlimited practice with cards from the full deck.',
    target: 30,
    reward: 'FREEPLAY UNLOCKED',
    xpReward: 500,
    icon: '🔓',
  },
];
