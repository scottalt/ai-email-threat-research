'use client';

import { useState } from 'react';
import { getShuffledDeck } from '@/data/cards';
import { GameCard } from './GameCard';
import { FeedbackCard } from './FeedbackCard';
import { RoundSummary } from './RoundSummary';
import { StartScreen } from './StartScreen';
import type { Card, Answer, RoundResult } from '@/lib/types';

const ROUND_SIZE = 10;
type GamePhase = 'start' | 'playing' | 'feedback' | 'summary';

export function Game() {
  const [phase, setPhase] = useState<GamePhase>('start');
  const [deck, setDeck] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);

  function startRound() {
    setDeck(getShuffledDeck(ROUND_SIZE));
    setCurrentIndex(0);
    setResults([]);
    setLastResult(null);
    setPhase('playing');
  }

  function handleAnswer(answer: Answer) {
    const card = deck[currentIndex];
    const correct = (answer === 'phishing') === card.isPhishing;
    const result: RoundResult = { card, userAnswer: answer, correct };
    setLastResult(result);
    setResults((prev) => [...prev, result]);
    setPhase('feedback');
  }

  function handleNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= ROUND_SIZE) {
      setPhase('summary');
    } else {
      setCurrentIndex(nextIndex);
      setPhase('playing');
    }
  }

  const score = results.filter((r) => r.correct).length;

  if (phase === 'start') {
    return <StartScreen onStart={startRound} />;
  }

  if (phase === 'summary') {
    return (
      <RoundSummary
        score={score}
        total={ROUND_SIZE}
        results={results}
        onPlayAgain={startRound}
      />
    );
  }

  if (phase === 'feedback' && lastResult) {
    return (
      <FeedbackCard
        result={lastResult}
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
      />
    );
  }

  return null;
}
