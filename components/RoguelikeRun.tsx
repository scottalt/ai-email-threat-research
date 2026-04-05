'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoguelikeHUD } from './RoguelikeHUD';
import { RoguelikePerkShop } from './RoguelikePerkShop';
import { RoguelikeResult } from './RoguelikeResult';
import { RoguelikeUpgrades } from './RoguelikeUpgrades';
import { RoguelikeFeedback } from './RoguelikeFeedback';
import { RoguelikeWager } from './RoguelikeWager';
import { RoguelikeFloorIntro } from './RoguelikeFloorIntro';
import { RoguelikeCardDisplay } from './RoguelikeCardDisplay';
import type { UpgradeId } from '@/lib/roguelike-upgrades';
import { useSigint } from '@/lib/SigintContext';
import { useSoundEnabled } from '@/lib/useSoundEnabled';
import { playCorrect, playWrong, playFloorClear, playLifeLost } from '@/lib/sounds';
import { getTimerDuration } from '@/lib/roguelike-gimmicks';
import { GIMMICK_DEFS, INTEL_WAGER_OPTIONS, ROGUELIKE_FLOORS } from '@/lib/roguelike';
import type { GimmickId, PerkId, CardModifier } from '@/lib/roguelike';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SafeCard {
  _idx: number;
  type: string;
  from: string;
  subject?: string;
  body: string;
  authStatus?: string;
}

interface RoguelikeCardAssignment {
  cardId: string;
  modifiers: CardModifier[];
}

interface FeedbackData {
  correct: boolean;
  isPhishing: boolean;
  explanation: string;
  technique: string;
  cardScore: number;
  lives: number;
  intel: number;
  score: number;
  streak: number;
  status: 'active' | 'dead' | 'completed';
  floorCleared: boolean;
  floorsCleared: number;
  modifiers: CardModifier[];
}

interface ResultData {
  finalScore: number;
  clearanceEarned: number;
  floorsCleared: number;
  deaths: number;
  bestStreak: number;
  cardsAnswered: number;
  cardsCorrect: number;
  operationName: string;
  newAchievements?: string[];
  xpEarned?: number;
}

type Phase = 'lobby' | 'loading' | 'floor' | 'feedback' | 'shop' | 'result' | 'floor-intro' | 'wager' | 'upgrades' | 'paused-prompt';

interface Props {
  onBack: () => void;
  onPlayAgain: () => void;
}

// ── Timer constants ──
const TIMED_MODIFIER_DURATION = 12000;
const SLOW_TIME_BONUS = 5000;

// ── Component ─────────────────────────────────────────────────────────────────

export function RoguelikeRun({ onBack, onPlayAgain }: Props) {
  const { triggerSigint, triggerCustom } = useSigint();
  const { soundEnabled } = useSoundEnabled();

  // ── Phase & run identity ──
  const [phase, setPhase] = useState<Phase>('lobby');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [operationName, setOperationName] = useState('');

  // ── Run state ──
  const [floor, setFloor] = useState(0);
  const [totalFloors, setTotalFloors] = useState(ROGUELIKE_FLOORS);
  const [gimmick, setGimmick] = useState<GimmickId | null>(null);
  const [gimmicks, setGimmicks] = useState<(GimmickId | null)[]>([]);
  const [lives, setLives] = useState(3);
  const [livesMax, setLivesMax] = useState(3);
  const [intel, setIntel] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [perks, setPerks] = useState<PerkId[]>([]);

  // ── Upgrade state ──
  const [ownedUpgrades, setOwnedUpgrades] = useState<UpgradeId[]>([]);
  const [upgradeClearance, setUpgradeClearance] = useState(0);
  const [upgradeReturnPhase, setUpgradeReturnPhase] = useState<Phase>('loading');

  // ── Floor card state ──
  const [cards, setCards] = useState<SafeCard[]>([]);
  const [assignments, setAssignments] = useState<RoguelikeCardAssignment[]>([]);
  const [cardIndex, setCardIndex] = useState(0);

  // ── Shop state ──
  const [shopPerks, setShopPerks] = useState<PerkId[]>([]);
  const [nextGimmick, setNextGimmick] = useState<GimmickId | null>(null);

  // ── Result / feedback ──
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);

  // ── Gimmick-specific state ──
  const [wrongShake, setWrongShake] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<'legit' | 'phishing' | null>(null);
  const [selectedWager, setSelectedWager] = useState<number>(0);
  const [wagerResult, setWagerResult] = useState<{ won: boolean; amount: number } | null>(null);
  const [inspectedFields, setInspectedFields] = useState<Set<string>>(new Set());
  const [freeInspections, setFreeInspections] = useState(0);
  const [floorIntroGimmick, setFloorIntroGimmick] = useState<GimmickId | null>(null);

  // ── Paused run prompt state ──
  const [pausedRunInfo, setPausedRunInfo] = useState<{
    runId: string; operationName: string; score: number;
    floorReached: number; floorsCleared: number; livesRemaining: number;
  } | null>(null);
  const [pauseLoading, setPauseLoading] = useState(false);

  // ── Timer state ──
  const [timerActive, setTimerActive] = useState(false);
  const [timerDurationMs, setTimerDurationMs] = useState(0);
  const [timerProgress, setTimerProgress] = useState(1); // 1 = full, 0 = expired
  const timerStartRef = useRef(0);
  const timerRafRef = useRef<number>(0);

  // ── Toast state ──
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast(msg);
    setToastKey((k) => k + 1);
    toastTimeout.current = setTimeout(() => setToast(null), 2000);
  }

  // ── Shop SIGINT line state ──
  const [shopSigintLine, setShopSigintLine] = useState<string>('');

  // ── Timeout refs for cleanup ──
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floorIntroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refs ──
  const renderTimestamp = useRef(Date.now());
  const sigintFired = useRef(false);
  const answering = useRef(false);

  // ── SIGINT on mount ──
  useEffect(() => {
    if (sigintFired.current) return;
    sigintFired.current = true;
    triggerSigint('first_roguelike');
  }, [triggerSigint]);

  // ── Fetch upgrades on mount so lobby button shows clearance ──
  useEffect(() => {
    fetch('/api/roguelike/upgrades')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setOwnedUpgrades(data.upgrades ?? []);
          setUpgradeClearance(data.clearance ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  // ── Cleanup timeouts on unmount ──
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      if (floorIntroTimeoutRef.current) clearTimeout(floorIntroTimeoutRef.current);
    };
  }, []);

  // ── Compute effective timer duration for current card ──
  const getEffectiveTimerMs = useCallback((): number | null => {
    const currentAssignment = assignments[cardIndex] ?? null;
    const currentModifiers: CardModifier[] = currentAssignment?.modifiers ?? [];

    // UNDER_PRESSURE gimmick timer
    const gimmickTimer = getTimerDuration(gimmick, floor);
    // TIMED modifier timer
    const hasTimedModifier = currentModifiers.includes('TIMED');

    // Pick the timer source (gimmick takes precedence, modifier as fallback)
    let baseMs: number | null = null;
    if (gimmickTimer !== null) {
      baseMs = gimmickTimer;
    } else if (hasTimedModifier) {
      baseMs = TIMED_MODIFIER_DURATION;
    }

    if (baseMs === null) return null;

    // SLOW_TIME perk adds +5000ms
    if (perks.includes('SLOW_TIME')) {
      baseMs += SLOW_TIME_BONUS;
    }

    return baseMs;
  }, [assignments, cardIndex, gimmick, floor, perks]);

  // ── Start the run (only when player clicks START from lobby) ──
  useEffect(() => {
    if (phase !== 'loading') return;
    let cancelled = false;

    async function startRun() {
      try {
        const res = await fetch('/api/roguelike/start', { method: 'POST' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;

        // Server found a paused run — prompt user to resume or abandon
        if (data.pausedRun) {
          setPausedRunInfo(data.pausedRun);
          setPhase('paused-prompt');
          return;
        }

        setRunId(data.runId);
        setOperationName(data.operationName);
        setFloor(data.currentFloor);
        setTotalFloors(data.totalFloors);
        setLives(data.lives);
        setLivesMax(data.maxLives);
        setIntel(data.intel);
        setScore(data.score);
        setGimmick(data.gimmick ?? null);
        setGimmicks([data.gimmick ?? null]);
        setCards(data.cards ?? []);
        setAssignments(data.assignments ?? []);
        setCardIndex(0);
        if (data.freeInspections) setFreeInspections(data.freeInspections);
        renderTimestamp.current = Date.now();

        // Show floor intro
        setFloorIntroGimmick(data.gimmick ?? null);
        setPhase('floor-intro');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to start run');
      }
    }

    startRun();
    return () => { cancelled = true; };
  }, [phase]);

  // Floor intro requires tap to proceed (no auto-dismiss)

  // ── Reset renderTimestamp each time cardIndex changes ──
  useEffect(() => {
    renderTimestamp.current = Date.now();
  }, [cardIndex]);

  // ── Timer management — start/stop on card change or phase change ──
  useEffect(() => {
    // Clean up any existing timer
    if (timerRafRef.current) {
      cancelAnimationFrame(timerRafRef.current);
      timerRafRef.current = 0;
    }

    if (phase !== 'floor') {
      setTimerActive(false);
      return;
    }

    const effectiveMs = getEffectiveTimerMs();
    if (effectiveMs === null) {
      setTimerActive(false);
      return;
    }

    setTimerDurationMs(effectiveMs);
    setTimerActive(true);
    setTimerProgress(1);
    timerStartRef.current = Date.now();

    function tick() {
      const elapsed = Date.now() - timerStartRef.current;
      const remaining = 1 - elapsed / effectiveMs!;
      if (remaining <= 0) {
        setTimerProgress(0);
        setTimerActive(false);
        return;
      }
      setTimerProgress(remaining);
      timerRafRef.current = requestAnimationFrame(tick);
    }

    timerRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (timerRafRef.current) {
        cancelAnimationFrame(timerRafRef.current);
        timerRafRef.current = 0;
      }
    };
  }, [phase, cardIndex, getEffectiveTimerMs]);

  // ── Timer expiry — auto-submit wrong answer ──
  useEffect(() => {
    if (!timerActive && timerProgress <= 0 && phase === 'floor' && timerDurationMs > 0) {
      // Timer expired — force wrong answer
      handleAnswer('legit', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive, timerProgress, phase]);

  // ── Derived: current card & modifiers ──
  const currentCard = cards[cardIndex] ?? null;
  const currentAssignment = assignments[cardIndex] ?? null;
  const currentModifiers: CardModifier[] = currentAssignment?.modifiers ?? [];

  // ── BLACKOUT gimmick — determine what to redact per card ──
  const isBlackout = gimmick === 'BLACKOUT';
  const blackoutRedactSender = isBlackout && cardIndex % 2 === 0;
  const blackoutRedactSubject = isBlackout && cardIndex % 2 !== 0;

  // ── CONFIDENCE gimmick / HIGH_ROLLER upgrade (wager from floor 2+) ──
  const isConfidence = gimmick === 'CONFIDENCE' ||
    (ownedUpgrades.includes('HIGH_ROLLER') && floor >= 1);

  // ── Finalize run (PATCH) ──
  async function finalizeRun(id: string): Promise<ResultData | null> {
    try {
      const res = await fetch(`/api/roguelike/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`[RoguelikeRun] Finalize failed: HTTP ${res.status}`, body);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.error('[RoguelikeRun] Finalize failed:', err);
      return null;
    }
  }

  // ── Handle answer ──
  async function handleAnswer(userAnswer: 'legit' | 'phishing', timerExpired = false, wager = 0) {
    if (!runId || !currentCard || answering.current) return;
    answering.current = true;

    // Stop timer
    if (timerRafRef.current) {
      cancelAnimationFrame(timerRafRef.current);
      timerRafRef.current = 0;
    }
    setTimerActive(false);

    const timeFromRenderMs = Date.now() - renderTimestamp.current;

    // If CONFIDENCE gimmick and not a timer expiry, show wager UI first
    if (isConfidence && !timerExpired && phase !== 'wager') {
      setPendingAnswer(userAnswer);
      setSelectedWager(0);
      setWagerResult(null);
      setPhase('wager');
      answering.current = false;
      return;
    }

    // Build the request body
    const bodyPayload: Record<string, unknown> = {
      cardIndex,
      userAnswer: timerExpired ? 'legit' : userAnswer, // timer expired = forced wrong-ish
      timeFromRenderMs,
    };

    // Include wager if in confidence mode
    const effectiveWager = wager > 0 ? wager : selectedWager;
    if (isConfidence && effectiveWager > 0) {
      bodyPayload.wager = effectiveWager;
    }

    try {
      const res = await fetch(`/api/roguelike/${runId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`[RoguelikeRun] Answer failed: HTTP ${res.status}`, body);
        // Detect expired run and show a clear message instead of generic retry
        if (res.status === 404 && typeof body.error === 'string' && body.error.includes('expired')) {
          setLoadError('Run expired. Sessions last 1 hour. Start a new run.');
          setPhase('loading');
        } else {
          showToast(body.error ?? 'Answer failed. Try again.');
        }
        answering.current = false;
        return;
      }

      const data: FeedbackData = await res.json();

      // Update tracked state
      setLives(data.lives);
      setIntel(data.intel);
      setScore(data.score);
      setStreak(data.streak);

      // Track deaths + shake effect
      if (!data.correct) {
        const liveLost = data.lives < lives;
        if (liveLost) setDeaths((d) => d + 1);
        setWrongShake(true);
        shakeTimeoutRef.current = setTimeout(() => setWrongShake(false), 700);
      }

      // Wager result
      if (isConfidence && effectiveWager > 0) {
        setWagerResult({
          won: data.correct,
          amount: effectiveWager,
        });
      }

      // Sounds
      if (soundEnabled) {
        if (data.correct) {
          playCorrect();
          if (data.floorCleared) playFloorClear();
        } else {
          playWrong();
          if (data.lives < lives) playLifeLost();
        }
      }

      // SIGINT mid-floor toasts
      const STREAK_3_TOASTS = [
        "Nice read. Keep that up.",
        "Three in a row. You're warming up.",
        "Good pattern recognition.",
      ];
      const STREAK_5_TOASTS = [
        "You're on fire, operative.",
        "Five straight. Impressive.",
        "Razor sharp. Don't get cocky.",
      ];
      const LIFE_LOST_TOASTS = [
        "Shake it off. Stay focused.",
        "That one was tricky. Regroup.",
        "Damage taken. Keep moving.",
      ];
      const LAST_LIFE_TOASTS = [
        "One more slip and we're dark.",
        "Final life. Every call matters now.",
        "Critical status. Focus.",
      ];
      const FLOOR_CLEAR_TOASTS = [
        "Floor cleared. Requisition incoming.",
        "Sector clear. Moving up.",
        "Good work. Resupply ahead.",
      ];

      // SIGINT mid-floor reactions (full Handler dialogue, not toasts)
      if (data.floorCleared) {
        triggerCustom([FLOOR_CLEAR_TOASTS[Math.floor(Math.random() * FLOOR_CLEAR_TOASTS.length)]], 'COPY');
      } else if (data.correct) {
        if (data.streak === 5) {
          triggerCustom([STREAK_5_TOASTS[Math.floor(Math.random() * STREAK_5_TOASTS.length)]], 'COPY');
        } else if (data.streak === 3) {
          triggerCustom([STREAK_3_TOASTS[Math.floor(Math.random() * STREAK_3_TOASTS.length)]], 'COPY');
        }
      } else {
        const liveLost = data.lives < lives;
        if (liveLost) {
          if (data.lives === 1) {
            triggerCustom([LAST_LIFE_TOASTS[Math.floor(Math.random() * LAST_LIFE_TOASTS.length)]], 'COPY');
          } else {
            triggerCustom([LIFE_LOST_TOASTS[Math.floor(Math.random() * LIFE_LOST_TOASTS.length)]], 'COPY');
          }
        }
      }

      setFeedbackData(data);
      setPendingAnswer(null);
      setPhase('feedback');
      // Player must tap CONTINUE to advance (matches main game pattern)

    } catch (err) {
      console.error('[RoguelikeRun] Answer failed:', err);
      answering.current = false;
    }
  }

  // ── Continue after feedback (manual tap, matches main game) ──
  async function handleContinue() {
    if (!runId || !feedbackData) return;

    const data = feedbackData;
    setFeedbackData(null);
    setWagerResult(null);
    answering.current = false;

    if (data.status === 'dead') {
      const result = await finalizeRun(runId);
      setResultData(result);
      setPhase('result');
      return;
    }

    if (data.floorCleared) {
      await loadShop(runId);
      return;
    }

    // Next card — reset inspection state
    setInspectedFields(new Set());
    setCardIndex((i) => i + 1);
    setPhase('floor');
  }

  // ── Submit wager ──
  function handleWagerConfirm(amount: number) {
    if (!pendingAnswer) return;
    setSelectedWager(amount);
    handleAnswer(pendingAnswer, false, amount);
  }

  function handleWagerSkip() {
    if (!pendingAnswer) return;
    setSelectedWager(0);
    handleAnswer(pendingAnswer, false, 0);
  }

  // ── Handle inspect (INVESTIGATION gimmick) — server-side deduction ──
  async function handleInspect(field: string) {
    if (!runId) return;
    try {
      const res = await fetch(`/api/roguelike/${runId}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error ?? 'Inspect failed');
        return;
      }
      const data = await res.json();
      setIntel(data.intel);
      setFreeInspections(data.freeInspections ?? 0);
      setInspectedFields((prev) => new Set(prev).add(field));
      // Store authStatus on the current card in local state
      setCards((prev) =>
        prev.map((c, i) =>
          i === cardIndex ? { ...c, authStatus: data.authStatus } : c,
        ),
      );
    } catch {
      showToast('Inspect failed');
    }
  }

  // ── Upgrade panel ──
  async function fetchUpgrades() {
    try {
      const res = await fetch('/api/roguelike/upgrades');
      if (!res.ok) return;
      const data = await res.json();
      setOwnedUpgrades(data.upgrades ?? []);
      setUpgradeClearance(data.clearance ?? 0);
    } catch {
      // Silently fail — upgrades are optional
    }
  }

  function openUpgrades(returnPhase: Phase) {
    setUpgradeReturnPhase(returnPhase);
    fetchUpgrades();
    setPhase('upgrades');
  }

  async function handleUpgradePurchase(id: UpgradeId) {
    const res = await fetch('/api/roguelike/upgrades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upgradeId: id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Purchase failed');
    }
    const data = await res.json();
    setOwnedUpgrades(data.upgrades ?? []);
    setUpgradeClearance(data.clearance ?? 0);
  }

  // ── Shop SIGINT quips ──
  const SHOP_QUIPS = [
    "Choose wisely. Intel doesn't grow on trees.",
    "Every edge counts in there.",
    "I'd take the defensive option, but that's just me.",
    "Your call, operative.",
    "Spend smart. The next floor won't be easy.",
  ] as const;

  // ── Load shop ──
  async function loadShop(id: string) {
    try {
      const res = await fetch(`/api/roguelike/${id}/shop`);
      if (!res.ok) {
        await advanceToNextFloor(id);
        return;
      }
      const data = await res.json();
      // API returns full perk def objects; extract IDs for the shop component
      const offeringIds = (data.offerings ?? []).map((p: { id: string } | string) =>
        typeof p === 'string' ? p : p.id
      ) as PerkId[];
      setShopPerks(offeringIds);
      setIntel(data.intel);
      setLives(data.lives);

      // Use server-provided nextGimmick (only set if player has SIGNAL_INTERCEPT)
      const nextGimmickId: GimmickId | null = data.nextGimmick ?? null;
      setNextGimmick(nextGimmickId);

      if (nextGimmickId) {
        const gimmickDef = GIMMICK_DEFS[nextGimmickId];
        const INTEL_LINES = [
          `Intel suggests the next floor is ${gimmickDef.label}. Prepare accordingly.`,
          `Heads up — ${gimmickDef.label} protocols detected ahead.`,
          `Next batch: ${gimmickDef.label}. Adjust your strategy.`,
        ];
        setShopSigintLine(INTEL_LINES[Math.floor(Math.random() * INTEL_LINES.length)]);
      } else {
        setShopSigintLine(SHOP_QUIPS[Math.floor(Math.random() * SHOP_QUIPS.length)]);
      }

      setPhase('shop');
    } catch (err) {
      console.error('[RoguelikeRun] Shop load failed:', err);
      await advanceToNextFloor(id);
    }
  }

  // ── Buy perk ──
  async function handleBuyPerk(perkId: PerkId) {
    if (!runId) return;
    const res = await fetch(`/api/roguelike/${runId}/shop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perkId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(`[RoguelikeRun] Buy perk failed: HTTP ${res.status}`, body);
      throw new Error(body.error ?? 'Purchase failed');
    }
    const data = await res.json();
    setIntel(data.intel);
    setLives(data.lives);
    setPerks(data.perks ?? []);
  }

  // ── Skip shop / advance to next floor ──
  async function handleSkipShop() {
    if (!runId) return;
    await advanceToNextFloor(runId);
  }

  // ── Pause mission ──
  async function handlePause() {
    if (!runId) return;
    setPauseLoading(true);
    try {
      const res = await fetch(`/api/roguelike/${runId}/pause`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error ?? 'Failed to pause');
        return;
      }
      onBack();
    } catch {
      showToast('Failed to pause');
    } finally {
      setPauseLoading(false);
    }
  }

  // ── Resume a paused run ──
  async function handleResume() {
    if (!pausedRunInfo) return;
    setPauseLoading(true);
    try {
      const res = await fetch(`/api/roguelike/${pausedRunInfo.runId}/resume`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to resume');
      }
      const data = await res.json();

      if (data.runComplete) {
        setRunId(data.runId);
        setOperationName(data.operationName);
        const result = await finalizeRun(data.runId);
        setResultData(result);
        setPhase('result');
        return;
      }

      setRunId(data.runId);
      setOperationName(data.operationName);
      setFloor(data.currentFloor);
      setTotalFloors(data.totalFloors);
      setLives(data.lives);
      setLivesMax(data.maxLives);
      setIntel(data.intel);
      setScore(data.score);
      setGimmick(data.gimmick ?? null);
      setGimmicks((prev) => [...prev, data.gimmick ?? null]);
      setCards(data.cards ?? []);
      setAssignments(data.assignments ?? []);
      setCardIndex(0);
      setStreak(data.streak ?? 0);
      setDeaths(data.deaths ?? 0);
      setPerks(data.perks ?? []);
      if (data.freeInspections) setFreeInspections(data.freeInspections);
      if (data.activeUpgrades) setOwnedUpgrades(data.activeUpgrades as UpgradeId[]);
      renderTimestamp.current = Date.now();
      setPausedRunInfo(null);

      setFloorIntroGimmick(data.gimmick ?? null);
      setPhase('floor-intro');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to resume');
    } finally {
      setPauseLoading(false);
    }
  }

  // ── Abandon a paused run and start fresh ──
  async function handleAbandonPaused() {
    if (!pausedRunInfo) return;
    setPauseLoading(true);
    try {
      await fetch(`/api/roguelike/${pausedRunInfo.runId}`, { method: 'DELETE' });
      setPausedRunInfo(null);
      setPhase('loading'); // triggers startRun again
    } catch {
      showToast('Failed to abandon run');
    } finally {
      setPauseLoading(false);
    }
  }

  // ── POST next-floor and either start next floor or finalize ──
  async function advanceToNextFloor(id: string) {
    try {
      const res = await fetch(`/api/roguelike/${id}/next-floor`, { method: 'POST' });
      if (!res.ok) {
        const result = await finalizeRun(id);
        setResultData(result);
        setPhase('result');
        return;
      }

      const data = await res.json();

      if (data.runComplete) {
        const result = await finalizeRun(id);
        setResultData(result);
        setPhase('result');
        return;
      }

      // Load next floor data
      setFloor(data.currentFloor);
      setGimmick(data.gimmick ?? null);
      setGimmicks((prev) => {
        const updated = [...prev];
        if (data.currentFloor !== undefined && data.gimmick !== undefined) {
          updated[data.currentFloor] = data.gimmick ?? null;
        }
        return updated;
      });
      setCards(data.cards ?? []);
      setAssignments(data.assignments ?? []);
      setCardIndex(0);
      setInspectedFields(new Set());
      if (data.lives !== undefined) setLives(data.lives);
      if (data.intel !== undefined) setIntel(data.intel);
      if (data.score !== undefined) setScore(data.score);

      setNextGimmick(null);

      // Show floor intro
      setFloorIntroGimmick(data.gimmick ?? null);
      setPhase('floor-intro');
    } catch (err) {
      console.error('[RoguelikeRun] Next floor failed:', err);
      const result = await finalizeRun(id);
      setResultData(result);
      setPhase('result');
    }
  }

  // ── Timer color based on progress ──
  function getTimerColor(progress: number): string {
    if (progress > 0.5) return '#00ff41';
    if (progress > 0.25) return '#ffaa00';
    return '#ff3333';
  }

  // ── Render: upgrades panel ──
  if (phase === 'upgrades') {
    return (
      <RoguelikeUpgrades
        upgrades={ownedUpgrades}
        clearance={upgradeClearance}
        onPurchase={handleUpgradePurchase}
        onClose={() => setPhase(upgradeReturnPhase)}
      />
    );
  }

  // ── Render: mission lobby (player sees this first, clicks START to begin) ──
  if (phase === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8 font-mono min-h-[360px] anim-fade-in-up">
        {/* Operation header */}
        <div className="text-center space-y-1">
          <p className="text-xs text-[var(--c-muted)] tracking-widest">DEADLOCK</p>
          <p className="text-lg font-bold tracking-wider" style={{ color: '#ff3333', textShadow: '0 0 8px rgba(255,51,51,0.3)' }}>
            ROGUELIKE SURVIVAL
          </p>
        </div>

        {/* Tower visualization */}
        <div className="flex flex-col items-center gap-1 w-40">
          {Array.from({ length: ROGUELIKE_FLOORS }, (_, i) => ROGUELIKE_FLOORS - 1 - i).map((floorIdx) => (
            <div
              key={floorIdx}
              className="w-full term-border px-3 py-2 text-center"
              style={{
                opacity: 1 - floorIdx * 0.15,
                borderColor: floorIdx === ROGUELIKE_FLOORS - 1 ? 'rgba(255,51,51,0.4)' : 'color-mix(in srgb, var(--c-primary) 40%, transparent)',
              }}
            >
              <span className="text-xs tracking-widest" style={{ color: floorIdx === ROGUELIKE_FLOORS - 1 ? '#ff3333' : 'var(--c-secondary)' }}>
                {floorIdx === ROGUELIKE_FLOORS - 1 ? '⚠ FLOOR ' + (floorIdx + 1) + ' — BOSS' : 'FLOOR ' + (floorIdx + 1)}
              </span>
            </div>
          ))}
        </div>

        {/* Lives indicator */}
        {(() => {
          const lobbyLives = ownedUpgrades.includes('THICK_SKIN') ? 4 : 3;
          return (
            <div className="text-sm tracking-widest" style={{ color: '#ff3333' }}>
              {'♥'.repeat(lobbyLives)} {lobbyLives} LIVES
            </div>
          );
        })()}

        {/* START button */}
        <button
          onClick={() => setPhase('loading')}
          className="w-full max-w-xs py-4 term-border-bright font-bold tracking-widest text-sm active:scale-95 transition-all hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]"
          style={{ color: '#ff3333', borderColor: 'rgba(255,51,51,0.5)', textShadow: '0 0 6px rgba(255,51,51,0.3)' }}
        >
          [ START OPERATION ]
        </button>

        {/* Upgrades button */}
        <button
          onClick={() => openUpgrades('lobby')}
          className="py-2 px-4 term-border text-sm tracking-widest active:scale-95 transition-all"
          style={{ color: '#00d4ff', borderColor: 'rgba(0,212,255,0.35)' }}
        >
          [ UPGRADES ]
          {upgradeClearance > 0 && (
            <span className="text-[var(--c-muted)] text-xs ml-2">{upgradeClearance} CLR</span>
          )}
        </button>

        {/* Back button */}
        <button
          onClick={onBack}
          className="text-xs text-[var(--c-muted)] hover:text-[var(--c-secondary)] tracking-widest transition-colors"
        >
          [ BACK ]
        </button>
      </div>
    );
  }

  // ── Render: loading (after START clicked, API in flight) ──
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8 font-mono min-h-[360px] anim-fade-in-up">
        {loadError ? (
          <>
            <p className="text-sm text-[#ff3333] tracking-wide">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); setPhase('lobby'); setTimeout(() => setPhase('loading'), 100); }}
              className="py-2 px-6 term-border text-sm tracking-widest text-[var(--c-primary)] active:scale-95 transition-all"
            >
              [ RETRY ]
            </button>
            <button
              onClick={onBack}
              className="text-xs text-[var(--c-muted)] hover:text-[var(--c-secondary)] tracking-widest"
            >
              [ BACK ]
            </button>
          </>
        ) : (
          <p className="text-sm text-[var(--c-muted)] tracking-widest animate-pulse">
            INITIALIZING OPERATION...
          </p>
        )}
      </div>
    );
  }

  // ── Render: paused run prompt ──
  if (phase === 'paused-prompt' && pausedRunInfo) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 p-8 font-mono min-h-[360px] anim-fade-in-up">
        <h2 className="text-lg font-bold tracking-widest" style={{ color: '#ff3333' }}>
          PAUSED OPERATION
        </h2>
        <div className="term-border p-4 space-y-2 text-sm w-full max-w-xs">
          <div className="text-center font-bold text-[var(--c-primary)] tracking-wider">
            {pausedRunInfo.operationName}
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--c-muted)]">SCORE</span>
            <span className="text-[var(--c-secondary)] tabular-nums">{pausedRunInfo.score.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--c-muted)]">FLOOR</span>
            <span className="text-[var(--c-secondary)] tabular-nums">{pausedRunInfo.floorsCleared} cleared</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--c-muted)]">LIVES</span>
            <span className="tabular-nums" style={{ color: '#ff3333' }}>
              {Array.from({ length: pausedRunInfo.livesRemaining }, (_, i) => (
                <span key={i}>♥</span>
              ))}
            </span>
          </div>
        </div>
        <button
          onClick={handleResume}
          disabled={pauseLoading}
          className="w-full max-w-xs py-3 px-6 term-border-bright text-sm tracking-widest text-[var(--c-primary)] font-bold active:scale-95 transition-all hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)]"
        >
          {pauseLoading ? 'RESUMING...' : '[ RESUME MISSION ]'}
        </button>
        <button
          onClick={handleAbandonPaused}
          disabled={pauseLoading}
          className="w-full max-w-xs py-3 px-6 term-border text-sm tracking-widest text-[var(--c-muted)] hover:text-[#ff3333] active:scale-95 transition-all"
        >
          [ ABANDON — START NEW ]
        </button>
        <button
          onClick={onBack}
          className="text-xs text-[var(--c-muted)] hover:text-[var(--c-secondary)] tracking-widest"
        >
          [ BACK ]
        </button>
      </div>
    );
  }

  // ── Render: floor intro ──
  if (phase === 'floor-intro') {
    return (
      <RoguelikeFloorIntro
        floor={floor}
        gimmick={floorIntroGimmick}
        onSkip={() => {
          if (floorIntroTimeoutRef.current) clearTimeout(floorIntroTimeoutRef.current);
          setPhase('floor');
        }}
      />
    );
  }

  // ── Render: result (fallback when resultData failed to load) ──
  if (phase === 'result' && !resultData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 font-mono">
        <p className="text-sm text-[#ff3333] tracking-wide">Failed to load run results.</p>
        <button onClick={onPlayAgain} className="py-2 px-6 term-border text-sm tracking-widest text-[var(--c-primary)] active:scale-95 transition-all">
          [ PLAY AGAIN ]
        </button>
        <button onClick={onBack} className="text-xs text-[var(--c-muted)] hover:text-[var(--c-secondary)] tracking-widest">
          [ BACK ]
        </button>
      </div>
    );
  }

  // ── Render: result ──
  if (phase === 'result' && resultData) {
    const won = (resultData.floorsCleared ?? 0) >= totalFloors;
    return (
      <RoguelikeResult
        operationName={resultData.operationName || operationName}
        finalScore={resultData.finalScore}
        clearanceEarned={resultData.clearanceEarned}
        floorsCleared={resultData.floorsCleared}
        deaths={resultData.deaths}
        bestStreak={resultData.bestStreak}
        cardsAnswered={resultData.cardsAnswered}
        cardsCorrect={resultData.cardsCorrect}
        gimmicks={gimmicks}
        won={won}
        newAchievements={resultData.newAchievements}
        xpEarned={resultData.xpEarned}
        onPlayAgain={onPlayAgain}
        onBack={onBack}
      />
    );
  }

  // ── Render: shop ──
  if (phase === 'shop') {
    return (
      <RoguelikePerkShop
        perks={shopPerks}
        intel={intel}
        lives={lives}
        floor={floor}
        nextGimmick={nextGimmick}
        sigintLine={shopSigintLine}
        onBuy={handleBuyPerk}
        onSkip={handleSkipShop}
        onPause={handlePause}
      />
    );
  }

  // ── Render: wager selection (CONFIDENCE gimmick) ──
  if (phase === 'wager' && pendingAnswer) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md mx-auto p-4 font-mono anim-fade-in-up">
        <RoguelikeHUD
          floor={floor}
          gimmick={gimmick}
          lives={lives}
          livesMax={livesMax}
          intel={intel}
          streak={streak}
          cardIndex={cardIndex}
          totalCards={cards.length}
          modifiers={currentModifiers}
          omniscience={ownedUpgrades.includes('OMNISCIENCE')}
          perks={perks}
        />

        <RoguelikeWager
          intel={intel}
          pendingAnswer={pendingAnswer}
          onWager={handleWagerConfirm}
          onSkip={handleWagerSkip}
        />

        {/* Abort during wager */}
        <button
          onClick={onBack}
          aria-label="Abort mission and return to menu"
          className="text-xs text-[var(--c-muted)] hover:text-[var(--c-secondary)] tracking-widest text-center pt-1 transition-colors"
        >
          [ ABORT MISSION ]
        </button>
      </div>
    );
  }

  // ── Render: floor / feedback ──
  if (!currentCard) {
    return (
      <div className="flex items-center justify-center p-8 font-mono">
        <p className="text-sm text-[var(--c-muted)] tracking-widest animate-pulse">LOADING FLOOR...</p>
      </div>
    );
  }

  // Death-level shake is more dramatic
  const isDead = feedbackData?.status === 'dead';
  const shakeClass = wrongShake
    ? (isDead ? 'anim-death-shake' : 'anim-shake')
    : '';
  const redFlashClass = wrongShake ? 'anim-red-flash' : '';

  return (
    <div className={`flex flex-col gap-4 w-full max-w-md mx-auto p-4 font-mono anim-fade-in-up ${phase === 'floor' ? shakeClass : ''}`}>
      {/* HUD */}
      <RoguelikeHUD
        floor={floor}
        gimmick={gimmick}
        lives={lives}
        livesMax={livesMax}
        intel={intel}
        streak={streak}
        cardIndex={cardIndex}
        totalCards={cards.length}
        modifiers={currentModifiers}
        omniscience={ownedUpgrades.includes('OMNISCIENCE')}
        perks={perks}
      />

      {/* Feedback overlay */}
      {phase === 'feedback' && feedbackData && (
        <RoguelikeFeedback
          feedbackData={feedbackData}
          wagerResult={wagerResult}
          isDead={!!isDead}
          onContinue={handleContinue}
        />
      )}

      {/* Card display */}
      {phase === 'floor' && (
        <>
          <RoguelikeCardDisplay
            card={currentCard}
            cardIndex={cardIndex}
            cards={cards}
            gimmick={gimmick}
            modifiers={currentModifiers}
            blackoutRedactSender={blackoutRedactSender}
            blackoutRedactSubject={blackoutRedactSubject}
            inspectedFields={inspectedFields}
            onInspect={handleInspect}
            intel={intel}
            freeInspections={freeInspections}
            timerProgress={timerActive && timerDurationMs > 0 ? timerProgress : null}
            timerColor={getTimerColor(timerProgress)}
            cardClassName={redFlashClass}
          />

          {/* Answer buttons — phishing left, legit right (matches main game) */}
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('phishing')}
              aria-label="Mark as phishing"
              className="flex-1 py-3 term-border text-sm tracking-widest hover:bg-[color-mix(in_srgb,#ff3333_8%,transparent)] active:scale-95 transition-all"
              style={{ color: '#ff3333', borderColor: 'rgba(255,51,51,0.5)' }}
            >
              [ PHISHING ]
            </button>
            <button
              onClick={() => handleAnswer('legit')}
              aria-label="Mark as legitimate"
              className="flex-1 py-3 term-border text-sm tracking-widest text-[var(--c-primary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:scale-95 transition-all"
            >
              [ LEGIT ]
            </button>
          </div>

          {/* Back link */}
          <button
            onClick={onBack}
            aria-label="Abort mission and return to menu"
            className="text-xs text-[var(--c-muted)] hover:text-[var(--c-secondary)] tracking-widest text-center pt-1 transition-colors"
          >
            [ ABORT MISSION ]
          </button>
        </>
      )}

      {/* SIGINT mid-floor toast */}
      {toast && (
        <div
          key={toastKey}
          className="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--c-bg)] border text-[var(--c-secondary)] text-xs font-mono tracking-wide anim-toast z-50 max-w-xs text-center"
          style={{ borderColor: 'color-mix(in srgb, var(--c-primary) 40%, transparent)' }}
        >
          <span className="text-[var(--c-primary)]">SIGINT:</span> {toast}
        </div>
      )}
    </div>
  );
}
