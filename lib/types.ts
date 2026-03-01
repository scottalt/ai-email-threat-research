export type CardType = 'email' | 'sms';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Answer = 'phishing' | 'legit';
export type Confidence = 'guessing' | 'likely' | 'certain';

export interface Card {
  id: string;
  type: CardType;
  difficulty: Difficulty;
  isPhishing: boolean;
  from: string;
  subject?: string;
  body: string;
  clues: string[];
  explanation: string;
  highlights?: string[];
}

export interface RoundResult {
  card: Card;
  userAnswer: Answer;
  correct: boolean;
  confidence: Confidence;
  pointsEarned: number;
}

export type GameMode = 'daily' | 'freeplay';
