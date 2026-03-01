'use client';

import { useState } from 'react';
import { getShuffledDeck, getDailyDeck } from '@/data/cards';
import { GameCard } from './GameCard';
import { FeedbackCard } from './FeedbackCard';
import { RoundSummary } from './RoundSummary';
import { StartScreen } from './StartScreen';
import type { Card, Answer, Confidence, RoundResult, GameMode } from '@/lib/types';
import { useSoundEnabled } from '@/lib/useSoundEnabled';
import { playCorrect, playWrong, playStreak } from '@/lib/sounds';

const ROUND_SIZE = 10;
const BASE_POINTS = 100;
const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  guessing: 1,
  likely: 2,
  certain: 3,
};
const STREAK_BONUS = 50;

type GamePhase = 'start' | 'playing' | 'feedback' | 'summary' | 'daily_complete';

export function Game() {
  const [phase, setPhase] = useState<GamePhase>('start');
  const [deck, setDeck] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [streak, setStreak] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [mode, setMode] = useState<GameMode>('freeplay');
  const [dailyResult, setDailyResult] = useState<{ score: number; totalScore: number } | null>(null);
  const { soundEnabled, toggleSound } = useSoundEnabled();

  function getToday(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  function getDailyStorageKey(): string {
    return `daily_${getToday()}`;
  }

  function startRound(newMode: GameMode = 'freeplay') {
    if (newMode === 'daily') {
      const stored = localStorage.getItem(getDailyStorageKey());
      if (stored) {
        try {
          setDailyResult(JSON.parse(stored));
        } catch {
          setDailyResult(null);
        }
        setMode('daily');
        setPhase('daily_complete');
        return;
      }
    }
    setMode(newMode);
    setDeck(newMode === 'daily' ? getDailyDeck() : getShuffledDeck(ROUND_SIZE));
    setCurrentIndex(0);
    setResults([]);
    setLastResult(null);
    setStreak(0);
    setTotalScore(0);
    setPhase('playing');
  }

  function handleAnswer(answer: Answer, confidence: Confidence) {
    const card = deck[currentIndex];
    const correct = (answer === 'phishing') === card.isPhishing;

    const newStreak = correct ? streak + 1 : 0;
    const streakBonus = correct && newStreak > 0 && newStreak % 3 === 0 ? STREAK_BONUS : 0;
    const pointsEarned = correct
      ? BASE_POINTS * CONFIDENCE_MULTIPLIER[confidence] + streakBonus
      : 0;

    const result: RoundResult = { card, userAnswer: answer, correct, confidence, pointsEarned };
    setLastResult(result);
    setResults((prev) => [...prev, result]);
    setStreak(newStreak);
    setTotalScore((prev) => prev + pointsEarned);

    if (soundEnabled) {
      if (streakBonus > 0) playStreak();
      else if (correct) playCorrect();
      else playWrong();
    }

    setPhase('feedback');
  }

  function handleNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= ROUND_SIZE) {
      if (mode === 'daily') {
        const correctCount = results.filter((r) => r.correct).length;
        localStorage.setItem(
          getDailyStorageKey(),
          JSON.stringify({ score: correctCount, totalScore })
        );
      }
      setPhase('summary');
    } else {
      setCurrentIndex(nextIndex);
      setPhase('playing');
    }
  }

  if (phase === 'start') {
    return <StartScreen onStart={startRound} />;
  }

  if (phase === 'summary') {
    return (
      <RoundSummary
        score={results.filter((r) => r.correct).length}
        total={ROUND_SIZE}
        totalScore={totalScore}
        results={results}
        mode={mode}
        date={getToday()}
        onPlayAgain={() => startRound('freeplay')}
      />
    );
  }

  if (phase === 'daily_complete') {
    return (
      <div className="anim-fade-in-up w-full max-w-sm px-4 flex flex-col gap-4">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">DAILY_CHALLENGE</span>
            <span className="text-[#003a0e] text-xs font-mono">{getToday()}</span>
          </div>
          <div className="px-3 py-6 text-center space-y-2">
            <div className="text-xs font-mono text-[#00aa28] tracking-widest">ALREADY_DEPLOYED</div>
            <div className="text-4xl font-black font-mono text-[#00ff41] glow">
              {dailyResult?.totalScore ?? 0}
            </div>
            <div className="text-xs font-mono text-[#00aa28]">Come back tomorrow.</div>
          </div>
        </div>
        <button
          onClick={() => setPhase('start')}
          className="w-full py-4 term-border text-[#00aa28] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] active:scale-95 transition-all"
        >
          [ BACK TO TERMINAL ]
        </button>
      </div>
    );
  }

  if (phase === 'feedback' && lastResult) {
    return (
      <FeedbackCard
        result={lastResult}
        streak={streak}
        totalScore={totalScore}
        onNext={handleNext}
        questionNumber={currentIndex + 1}
        total={ROUND_SIZE}
      />
    );
  }

  const currentCard = deck[currentIndex];
  if (phase === 'playing' && currentCard) {
    return (
      <GameCard
        key={currentCard.id}
        card={currentCard}
        onAnswer={handleAnswer}
        questionNumber={currentIndex + 1}
        total={ROUND_SIZE}
        streak={streak}
        totalScore={totalScore}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />
    );
  }

  return null;
}
