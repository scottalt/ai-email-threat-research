export type CardType = 'email' | 'sms';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
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
  technique?: string | null;
}

export interface RoundResult {
  card: Card;
  userAnswer: Answer;
  correct: boolean;
  confidence: Confidence;
  pointsEarned: number;
}

export type GameMode = 'freeplay' | 'daily' | 'research';

// Research mode card — extends Card with research metadata from cards_real
export interface ResearchCard extends Card {
  cardSource: 'real';
  technique: string | null;
  secondaryTechnique: string | null;
  isGenaiSuspected: boolean | null;
  genaiConfidence: 'low' | 'medium' | 'high' | null;
  grammarQuality: number | null;
  proseFluency: number | null;
  personalizationLevel: number | null;
  contextualCoherence: number | null;
  datasetVersion: string;
}

// Answer event payload sent to POST /api/answers
export interface AnswerEvent {
  sessionId: string;
  cardId: string;
  cardSource: 'generated' | 'real';
  isPhishing: boolean;
  technique: string | null;
  secondaryTechnique: string | null;
  isGenaiSuspected: boolean | null;
  genaiConfidence: string | null;
  grammarQuality: number | null;
  proseFluency: number | null;
  personalizationLevel: number | null;
  contextualCoherence: number | null;
  difficulty: string;
  type: string;
  userAnswer: Answer;
  correct: boolean;
  confidence: Confidence;
  timeFromRenderMs: number | null;
  timeFromConfidenceMs: number | null;
  confidenceSelectionTimeMs: number | null;
  scrollDepthPct: number;
  answerMethod: 'swipe' | 'button';
  answerOrdinal: number;
  streakAtAnswerTime: number;
  correctCountAtTime: number;
  gameMode: GameMode;
  isDailyChallenge: boolean;
  datasetVersion: string | null;
}

// Session payload sent alongside each answer event
export interface SessionPayload {
  sessionId: string;
  gameMode: GameMode;
  isDailyChallenge: boolean;
  startedAt: string;
  completedAt: string | null;
  cardsAnswered: number;
  finalScore: number | null;
  finalRank: string | null;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  viewportWidth: number;
  viewportHeight: number;
  referrer: string;
}
