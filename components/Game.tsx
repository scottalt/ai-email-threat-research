'use client';

import { useState, useRef, useEffect } from 'react';
import { getShuffledDeck, getDailyDeck } from '@/data/cards';
import { GameCard } from './GameCard';
import { FeedbackCard } from './FeedbackCard';
import { RoundSummary } from './RoundSummary';
import { StartScreen } from './StartScreen';
import { ResearchIntro } from './ResearchIntro';
import type { Card, Answer, Confidence, RoundResult, GameMode, AnswerEvent, SessionPayload } from '@/lib/types';
import { useSoundEnabled } from '@/lib/useSoundEnabled';
import { playCorrect, playWrong, playStreak } from '@/lib/sounds';
import { getRank } from '@/lib/rank';

const ROUND_SIZE = 10;
const BASE_POINTS = 100;
const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  guessing: 1,
  likely: 2,
  certain: 3,
};
const STREAK_BONUS = 50;

type GamePhase = 'start' | 'playing' | 'feedback' | 'summary' | 'daily_complete' | 'loading' | 'research_intro' | 'research_unavailable';

export function Game({ previewMode = false }: { previewMode?: boolean }) {
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
  const sessionId = useRef<string>('');
  const sessionStartedAt = useRef<string>('');
  const [correctCount, setCorrectCount] = useState(0);
  const hasAutoStarted = useRef(false);

  // Auto-start in preview mode — skip the start screen entirely
  useEffect(() => {
    if (previewMode && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      startRound('preview');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getToday(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  function getDailyStorageKey(): string {
    return `daily_${getToday()}`;
  }

  function generateSessionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const w = window.innerWidth;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  function startRound(newMode: GameMode = 'freeplay') {
    sessionId.current = generateSessionId();
    sessionStartedAt.current = new Date().toISOString();

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
    setCurrentIndex(0);
    setResults([]);
    setLastResult(null);
    setStreak(0);
    setTotalScore(0);
    setCorrectCount(0);

    if (newMode === 'research' || newMode === 'preview') {
      setPhase('loading' as GamePhase);
      fetch('/api/cards/research')
        .then((r) => r.json())
        .then((cards: Card[]) => {
          if (!cards.length) {
            // Research deck not ready — fall back to freeplay silently
            setMode('freeplay');
            setDeck(getShuffledDeck(ROUND_SIZE));
            setPhase('playing');
            return;
          }
          const arr = [...cards];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          const shuffled = arr.slice(0, ROUND_SIZE);
          setDeck(shuffled);
          // Preview mode skips intro; return players (localStorage) skip intro
          if (newMode === 'preview') {
            setPhase('playing');
          } else {
            const hasSeenIntro = typeof window !== 'undefined' && localStorage.getItem('research_intro_seen') === '1';
            setPhase(hasSeenIntro ? 'playing' : 'research_intro');
          }
        })
        .catch(() => setPhase('start'));
      return;
    }

    if (newMode === 'expert') {
      setPhase('loading' as GamePhase);
      fetch('/api/cards/expert')
        .then((r) => r.json())
        .then((cards: Card[]) => {
          if (!cards.length) {
            // No extreme cards yet — fall back to freeplay silently
            setMode('freeplay');
            setDeck(getShuffledDeck(ROUND_SIZE));
            setPhase('playing');
            return;
          }
          const arr = [...cards];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          setDeck(arr.slice(0, ROUND_SIZE));
          setPhase('playing');
        })
        .catch(() => setPhase('start'));
      return;
    }

    setDeck(newMode === 'daily' ? getDailyDeck() : getShuffledDeck(ROUND_SIZE));
    setPhase('playing');
  }

  function handleAnswer(answer: Answer, confidence: Confidence, timing?: {
    timeFromRenderMs: number;
    timeFromConfidenceMs: number | null;
    confidenceSelectionTimeMs: number | null;
    scrollDepthPct: number;
    answerMethod: 'swipe' | 'button';
    headersOpened: boolean;
    urlInspected: boolean;
  }) {
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
    const newCorrectCount = correct ? correctCount + 1 : correctCount;
    setCorrectCount(newCorrectCount);
    setTotalScore((prev) => prev + pointsEarned);

    if (soundEnabled) {
      if (streakBonus > 0) playStreak();
      else if (correct) playCorrect();
      else playWrong();
    }

    // Log answer event (fire and forget — never block the game, skip in preview mode)
    if (typeof window !== 'undefined' && mode !== 'preview') {
      const researchCard = card as Card & Record<string, unknown>;
      const answerEvent: AnswerEvent = {
        sessionId: sessionId.current,
        cardId: card.id,
        cardSource: (researchCard.cardSource as 'generated' | 'real') ?? 'generated',
        isPhishing: card.isPhishing,
        technique: (researchCard.technique as string | null) ?? null,
        secondaryTechnique: (researchCard.secondaryTechnique as string | null) ?? null,
        isGenaiSuspected: (researchCard.isGenaiSuspected as boolean | null) ?? null,
        genaiConfidence: (researchCard.genaiConfidence as string | null) ?? null,
        grammarQuality: (researchCard.grammarQuality as number | null) ?? null,
        proseFluency: (researchCard.proseFluency as number | null) ?? null,
        personalizationLevel: (researchCard.personalizationLevel as number | null) ?? null,
        contextualCoherence: (researchCard.contextualCoherence as number | null) ?? null,
        difficulty: card.difficulty,
        type: card.type,
        userAnswer: answer,
        correct,
        confidence,
        timeFromRenderMs: timing?.timeFromRenderMs ?? null,
        timeFromConfidenceMs: timing?.timeFromConfidenceMs ?? null,
        confidenceSelectionTimeMs: timing?.confidenceSelectionTimeMs ?? null,
        scrollDepthPct: timing?.scrollDepthPct ?? 0,
        answerMethod: timing?.answerMethod ?? 'button',
        answerOrdinal: currentIndex + 1,
        streakAtAnswerTime: newStreak,
        correctCountAtTime: newCorrectCount,
        gameMode: mode,
        isDailyChallenge: mode === 'daily',
        datasetVersion: (researchCard.datasetVersion as string | null) ?? null,
        headersOpened: timing?.headersOpened ?? false,
        urlInspected: timing?.urlInspected ?? false,
        authStatusSignal: card.authStatus,
        hasReplyTo: !!card.replyTo,
        hasUrl: /https?:\/\//.test(card.body),
        hasAttachment: !!card.attachmentName,
        hasSentAt: !!card.sentAt,
      };

      const sessionPayload: SessionPayload = {
        sessionId: sessionId.current,
        gameMode: mode,
        isDailyChallenge: mode === 'daily',
        startedAt: sessionStartedAt.current,
        completedAt: null,
        cardsAnswered: currentIndex + 1,
        finalScore: null,
        finalRank: null,
        deviceType: getDeviceType(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        referrer: document.referrer,
      };

      fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerEvent, session: sessionPayload }),
      }).catch(() => {});
    }

    setPhase('feedback');
  }

  function handleNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= deck.length || nextIndex >= ROUND_SIZE) {
      if (mode === 'daily') {
        const correctCount = results.filter((r) => r.correct).length;
        localStorage.setItem(
          getDailyStorageKey(),
          JSON.stringify({ score: correctCount, totalScore })
        );
      }
      // Record session completion — fire and forget, skip in preview mode
      if (typeof window !== 'undefined' && mode !== 'preview') {
        fetch('/api/sessions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId.current,
            finalScore: totalScore,
            finalRank: getRank(totalScore).label,
            completedAt: new Date().toISOString(),
            cardsAnswered: Math.min(deck.length, ROUND_SIZE),
          }),
        }).catch(() => {});
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

  if (phase === ('loading' as GamePhase)) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <span className="text-[#00aa28] font-mono text-xs tracking-widest">LOADING RESEARCH DATA...</span>
      </div>
    );
  }

  if (phase === 'research_intro') {
    return <ResearchIntro onBegin={() => setPhase('playing')} />;
  }

  if (phase === 'research_unavailable') {
    return (
      <div className="anim-fade-in-up w-full max-w-sm px-4 flex flex-col gap-4">
        <div className="term-border bg-[#060c06] border-[rgba(255,170,0,0.3)]">
          <div className="border-b border-[rgba(255,170,0,0.3)] px-3 py-1.5">
            <span className="text-[#ffaa00] text-xs tracking-widest">RESEARCH_MODE</span>
          </div>
          <div className="px-3 py-6 text-center space-y-2">
            <div className="text-[#ffaa00] text-sm font-mono font-black tracking-wide">DATASET UNAVAILABLE</div>
            <p className="text-[#00aa28] text-xs font-mono leading-relaxed">
              The research dataset is still being assembled. No cards are available yet.
            </p>
            <p className="text-[#003a0e] text-xs font-mono">Check back soon.</p>
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

  if (phase === 'summary') {
    return (
      <RoundSummary
        score={results.filter((r) => r.correct).length}
        total={ROUND_SIZE}
        totalScore={totalScore}
        results={results}
        mode={mode}
        date={getToday()}
        onPlayAgain={() => setPhase('start')}
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
        sessionId={sessionId.current}
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
