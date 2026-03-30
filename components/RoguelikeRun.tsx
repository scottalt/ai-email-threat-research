'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoguelikeHUD } from './RoguelikeHUD';
import { RoguelikePerkShop } from './RoguelikePerkShop';
import { RoguelikeResult } from './RoguelikeResult';
import { RoguelikeUpgrades } from './RoguelikeUpgrades';
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
  authStatus: string;
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

type Phase = 'loading' | 'floor' | 'feedback' | 'shop' | 'result' | 'floor-intro' | 'wager' | 'upgrades';

interface Props {
  onBack: () => void;
  onPlayAgain: () => void;
}

// ── Timer constants ──
const TIMED_MODIFIER_DURATION = 12000;
const SLOW_TIME_BONUS = 5000;

// ── Component ─────────────────────────────────────────────────────────────────

export function RoguelikeRun({ onBack, onPlayAgain }: Props) {
  const { triggerSigint } = useSigint();
  const { soundEnabled } = useSoundEnabled();

  // ── Phase & run identity ──
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [operationName, setOperationName] = useState('');

  // ── Run state ──
  const [floor, setFloor] = useState(0);
  const [totalFloors, setTotalFloors] = useState(3);
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
  const [floorIntroGimmick, setFloorIntroGimmick] = useState<GimmickId | null>(null);

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

  // ── Start the run ──
  useEffect(() => {
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

        setRunId(data.runId);
        setOperationName(data.operationName);
        setFloor(data.currentFloor);
        setTotalFloors(data.totalFloors);
        setLives(data.lives);
        setLivesMax(data.maxLives);
        setIntel(data.intel);
        setScore(data.score);
        setGimmick(data.gimmick ?? null);
        const floorGimmicksArr: (GimmickId | null)[] = data.floorGimmicks ?? [];
        setGimmicks(floorGimmicksArr);
        setCards(data.cards ?? []);
        setAssignments(data.assignments ?? []);
        setCardIndex(0);
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
  }, []);

  // ── Floor intro auto-dismiss ──
  useEffect(() => {
    if (phase !== 'floor-intro') return;
    floorIntroTimeoutRef.current = setTimeout(() => {
      setPhase('floor');
      renderTimestamp.current = Date.now();
    }, 2000);
    return () => {
      if (floorIntroTimeoutRef.current) clearTimeout(floorIntroTimeoutRef.current);
    };
  }, [phase]);

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

  // Combined with REDACTED_SENDER modifier: if BLACKOUT + REDACTED_SENDER, redact both
  const hasRedactedSender = currentModifiers.includes('REDACTED_SENDER');
  const showSenderRedacted = hasRedactedSender || blackoutRedactSender || (isBlackout && hasRedactedSender);
  const showSubjectRedacted = blackoutRedactSubject || (isBlackout && hasRedactedSender);

  // ── INVESTIGATION gimmick ──
  const isInvestigation = gimmick === 'INVESTIGATION';

  // ── CONFIDENCE gimmick ──
  const isConfidence = gimmick === 'CONFIDENCE';

  // ── Modifier flags ──
  const hasLookalikeDomain = currentModifiers.includes('LOOKALIKE_DOMAIN');
  const hasDecoyRedFlags = currentModifiers.includes('DECOY_RED_FLAGS');
  const hasAiEnhanced = currentModifiers.includes('AI_ENHANCED');

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
  async function handleAnswer(userAnswer: 'legit' | 'phishing', timerExpired = false) {
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
    if (isConfidence && selectedWager > 0) {
      bodyPayload.wager = selectedWager;
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
        showToast('Answer failed. Try again.');
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
      if (isConfidence && selectedWager > 0) {
        setWagerResult({
          won: data.correct,
          amount: selectedWager,
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
      if (data.floorCleared) {
        showToast('Floor cleared. Requisition incoming.');
      } else if (data.correct) {
        if (data.streak === 5) {
          showToast("You're on fire, operative.");
        } else if (data.streak === 3) {
          showToast('Nice read. Keep that up.');
        }
      } else {
        const liveLost = data.lives < lives;
        if (liveLost) {
          if (data.lives === 1) {
            showToast("One more slip and we're dark.");
          } else {
            showToast('Shake it off. Stay focused.');
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
  function handleWagerSubmit() {
    if (!pendingAnswer) return;
    handleAnswer(pendingAnswer);
  }

  // ── Handle inspect (INVESTIGATION gimmick) ──
  function handleInspect(field: string) {
    if (intel < 3) return;
    setIntel((prev) => prev - 3);
    setInspectedFields((prev) => new Set(prev).add(field));
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
      setShopPerks(data.offerings ?? []);
      setIntel(data.intel);
      setLives(data.lives);
      setShopSigintLine(SHOP_QUIPS[Math.floor(Math.random() * SHOP_QUIPS.length)]);

      // Compute next floor's gimmick for shop preview
      const nextFloorIndex = floor + 1;
      const nextGimmickId = gimmicks[nextFloorIndex] ?? null;
      setNextGimmick(nextGimmickId);

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

  // ── Render: loading / mission lobby ──
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8 font-mono min-h-[360px] anim-fade-in-up">
        {loadError ? (
          <>
            <p className="text-sm text-[#ff3333] tracking-wide">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); setPhase('loading'); window.location.reload(); }}
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
          <>
            {/* Operation name */}
            <div className="text-center space-y-1">
              <p className="text-xs text-[var(--c-muted)] tracking-widest">OPERATION</p>
              <p
                className="text-2xl font-black tracking-widest glow animate-pulse"
                style={{ color: 'var(--c-primary)' }}
              >
                {operationName || '██████████'}
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
                    borderColor: 'color-mix(in srgb, var(--c-primary) 40%, transparent)',
                  }}
                >
                  <span className="text-xs tracking-widest" style={{ color: 'var(--c-secondary)' }}>
                    FLOOR {floorIdx + 1}
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

            {/* Upgrades button */}
            <button
              onClick={() => openUpgrades('loading')}
              className="py-2 px-4 term-border text-sm tracking-widest active:scale-95 transition-all"
              style={{ color: '#00d4ff', borderColor: 'rgba(0,212,255,0.35)' }}
            >
              [ UPGRADES ]
              {upgradeClearance > 0 && (
                <span className="text-[var(--c-muted)] text-xs ml-2">{upgradeClearance} CLR</span>
              )}
            </button>

            {/* Status */}
            <p className="text-xs text-[var(--c-muted)] tracking-widest animate-pulse">
              INITIALIZING...
            </p>
          </>
        )}
      </div>
    );
  }

  // ── Render: floor intro ──
  if (phase === 'floor-intro') {
    const introGimmickDef = floorIntroGimmick ? GIMMICK_DEFS[floorIntroGimmick] : null;
    const isBossFloor = introGimmickDef?.tier === 3;
    const introGimmickColor = introGimmickDef
      ? (isBossFloor ? '#ff3333' : introGimmickDef.tier === 1 ? '#00ff41' : '#00d4ff')
      : '#00ff41';
    const floorGlowStyle = isBossFloor
      ? { color: '#ff3333', textShadow: '0 0 20px #ff3333, 0 0 40px #ff333388, 0 0 80px #ff333344' }
      : { color: 'var(--c-primary)' };

    return (
      <div
        onClick={() => {
          if (floorIntroTimeoutRef.current) clearTimeout(floorIntroTimeoutRef.current);
          setPhase('floor');
        }}
        className="flex flex-col items-center justify-center gap-4 p-8 font-mono min-h-[300px] cursor-pointer select-none"
      >
        <div className="anim-floor-intro text-center space-y-3">
          {isBossFloor && (
            <p className="text-sm font-bold tracking-widest animate-pulse" style={{ color: '#ff3333' }}>
              ⚠ BOSS FLOOR ⚠
            </p>
          )}
          <p
            className="text-4xl font-black tracking-widest glow"
            style={floorGlowStyle}
          >
            FLOOR {floor + 1}
          </p>
          {introGimmickDef && (
            <p
              className="text-lg font-bold tracking-widest"
              style={{ color: introGimmickColor }}
            >
              {introGimmickDef.label.toUpperCase()}
            </p>
          )}
          {introGimmickDef && (
            <p className="text-xs text-[var(--c-muted)] max-w-xs">
              {introGimmickDef.description}
            </p>
          )}
        </div>
        <p className="text-[var(--c-muted)] text-xs mt-4 animate-pulse">TAP TO START</p>
      </div>
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
        />

        <div className="term-border p-6 space-y-4 text-center">
          <p className="text-xs text-[var(--c-muted)] tracking-widest">CONFIDENCE WAGER</p>
          <p className="text-sm text-[var(--c-secondary)]">
            You answered{' '}
            <span
              className="font-bold tracking-wide"
              style={{ color: pendingAnswer === 'phishing' ? '#ff3333' : 'var(--c-primary)' }}
            >
              {pendingAnswer.toUpperCase()}
            </span>
          </p>

          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-2xl font-black tabular-nums" style={{ color: '#ffaa00' }}>
              {intel}
            </span>
            <span className="text-xs text-[var(--c-muted)]">INTEL AVAILABLE</span>
          </div>

          <p className="text-xs text-[var(--c-muted)]">How much Intel will you wager?</p>

          <div className="flex gap-2 justify-center flex-wrap">
            {/* Skip (0) option */}
            <button
              onClick={() => setSelectedWager(0)}
              className={`py-2 px-4 term-border text-sm tracking-widest transition-all active:scale-95 ${
                selectedWager === 0 ? 'bg-[color-mix(in_srgb,var(--c-primary)_12%,transparent)]' : ''
              }`}
              style={{
                color: selectedWager === 0 ? 'var(--c-primary)' : 'var(--c-muted)',
                borderColor: selectedWager === 0 ? 'var(--c-primary)' : undefined,
              }}
            >
              SKIP
            </button>

            {INTEL_WAGER_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedWager(amount)}
                disabled={intel < amount}
                className={`py-2 px-4 term-border text-sm tracking-widest transition-all active:scale-95 ${
                  selectedWager === amount ? 'anim-wager-pulse' : ''
                } ${intel < amount ? 'opacity-30 cursor-not-allowed' : ''}`}
                style={{
                  color: selectedWager === amount ? '#ffaa00' : 'var(--c-secondary)',
                  borderColor: selectedWager === amount ? '#ffaa00' : undefined,
                }}
              >
                {amount}
              </button>
            ))}
          </div>

          <button
            onClick={handleWagerSubmit}
            className="w-full py-3 term-border text-sm tracking-widest text-[var(--c-primary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:scale-95 transition-all mt-2"
          >
            [ CONFIRM ]
          </button>
        </div>
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
      />

      {/* Feedback overlay */}
      {phase === 'feedback' && feedbackData && (
        <div
          className={`term-border p-4 space-y-2 anim-fade-in-up ${isDead ? 'p-6' : ''}`}
          style={{
            borderColor: feedbackData.correct ? '#00ff41' : '#ff3333',
            background: feedbackData.correct ? '#00ff4110' : '#ff333310',
          }}
        >
          <p
            className={`font-black tracking-widest text-center ${isDead ? 'text-2xl' : 'text-lg'}`}
            style={{ color: feedbackData.correct ? '#00ff41' : '#ff3333' }}
          >
            {isDead ? '[ MISSION FAILED ]' : feedbackData.correct ? '[ CORRECT ]' : '[ WRONG ]'}
          </p>
          {feedbackData.explanation && (
            <p className="text-xs text-[var(--c-secondary)] leading-relaxed">
              {feedbackData.explanation}
            </p>
          )}
          {feedbackData.technique && (
            <p className="text-xs text-[var(--c-muted)] tracking-wide">
              TECHNIQUE: {feedbackData.technique}
            </p>
          )}
          {/* Wager result */}
          {wagerResult && (
            <p
              className="text-sm font-bold tabular-nums text-center"
              style={{ color: wagerResult.won ? '#00ff41' : '#ff3333' }}
            >
              {wagerResult.won ? '+' : '-'}{wagerResult.amount} INTEL (WAGER)
            </p>
          )}
          <p
            className="text-xs font-bold tabular-nums text-right"
            style={{ color: feedbackData.correct ? '#ffaa00' : '#ff3333' }}
          >
            {feedbackData.cardScore > 0 ? '+' : ''}{feedbackData.cardScore} pts
          </p>
          <button
            onClick={handleContinue}
            className="w-full mt-3 py-3 term-border-bright text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:scale-95 transition-all"
          >
            {isDead ? '[ VIEW RESULTS ]' : feedbackData.floorCleared ? '[ CONTINUE ]' : '[ NEXT CARD ]'}
          </button>
        </div>
      )}

      {/* Card display */}
      {phase === 'floor' && (
        <>
          {/* TRIAGE: Inbox preview */}
          {gimmick === 'TRIAGE' && (
            <div className="term-border divide-y divide-[var(--c-dark)]">
              <div className="px-3 py-1.5 text-xs text-[var(--c-muted)] tracking-widest">
                INBOX — TRIAGE {cardIndex + 1}/{cards.length}
              </div>
              {cards.slice(0, Math.min(cards.length, cardIndex + 3)).map((card, i) => {
                const isCurrent = i === cardIndex;
                const isAnswered = i < cardIndex;
                return (
                  <div
                    key={i}
                    className={`px-3 py-2 text-xs font-mono ${
                      isCurrent ? 'bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)]' : ''
                    } ${isAnswered ? 'opacity-40 line-through' : ''}`}
                  >
                    <span className={isCurrent ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}>
                      {card.from?.split('@')[0] ?? '???'}
                    </span>
                    {card.subject && (
                      <span className="text-[var(--c-secondary)] ml-2 truncate">
                        {card.subject}
                      </span>
                    )}
                    {isCurrent && <span className="text-[var(--c-primary)] ml-2">◄</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* DECOY_RED_FLAGS modifier — suspicious marker (misleading on legit cards) */}
          {hasDecoyRedFlags && (
            <div className="text-xs tracking-widest text-center" style={{ color: '#ff333388' }}>
              {'>'} SUSPICIOUS {'<'}
            </div>
          )}

          <div className={`term-border p-4 space-y-3 ${redFlashClass}`}>
            {/* Timer progress bar */}
            {timerActive && timerDurationMs > 0 && (
              <div
                className="w-full h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--c-dark)' }}
              >
                <div
                  className="h-full rounded-full transition-colors duration-300"
                  style={{
                    width: `${timerProgress * 100}%`,
                    background: getTimerColor(timerProgress),
                  }}
                />
              </div>
            )}

            {/* AI_ENHANCED badge */}
            {hasAiEnhanced && (
              <div
                className="text-[10px] tracking-widest font-bold inline-block px-1.5 py-0.5 rounded-sm border"
                style={{ color: '#bf5fff', borderColor: '#bf5fff44', background: '#bf5fff18' }}
              >
                {'>'} AI-ENHANCED
              </div>
            )}

            {/* FROM */}
            {showSenderRedacted ? (
              <div className="text-sm">
                <span className="text-[var(--c-muted)]">FROM: </span>
                <span style={{ color: '#ff333366' }}>[REDACTED]</span>
              </div>
            ) : (
              <div className="text-sm flex items-center gap-2">
                <div>
                  <span className="text-[var(--c-muted)]">FROM: </span>
                  <span className="text-[var(--c-secondary)]">{currentCard.from}</span>
                </div>
                {/* LOOKALIKE_DOMAIN: no pre-answer indicator — would spoil the challenge */}
                {/* INVESTIGATION: inspect FROM button */}
                {isInvestigation && !inspectedFields.has('from') && (
                  <button
                    onClick={() => handleInspect('from')}
                    disabled={intel < 3}
                    className={`text-[10px] tracking-wide px-1.5 py-0.5 term-border transition-all active:scale-95 ${
                      intel < 3 ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    style={{ color: '#00d4ff' }}
                  >
                    INSPECT (-3)
                  </button>
                )}
                {/* INVESTIGATION: inspected FROM result */}
                {isInvestigation && inspectedFields.has('from') && currentCard.authStatus && (
                  <span className="text-[10px] text-[var(--c-muted)]">
                    [{currentCard.authStatus}]
                  </span>
                )}
              </div>
            )}

            {/* SUBJECT */}
            {currentCard.subject && (
              showSubjectRedacted ? (
                <div className="text-sm">
                  <span className="text-[var(--c-muted)]">SUBJ: </span>
                  <span style={{ color: '#ff333366' }}>[REDACTED]</span>
                </div>
              ) : (
                <div className="text-sm flex items-center gap-2">
                  <div>
                    <span className="text-[var(--c-muted)]">SUBJ: </span>
                    <span className="text-[var(--c-secondary)]">{currentCard.subject}</span>
                  </div>
                  {/* INVESTIGATION: inspect SUBJECT button */}
                  {isInvestigation && !inspectedFields.has('subject') && (
                    <button
                      onClick={() => handleInspect('subject')}
                      disabled={intel < 3}
                      className={`text-[10px] tracking-wide px-1.5 py-0.5 term-border transition-all active:scale-95 ${
                        intel < 3 ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                      style={{ color: '#00d4ff' }}
                    >
                      INSPECT (-3)
                    </button>
                  )}
                  {/* INVESTIGATION: inspected SUBJECT result — shows auth status */}
                  {isInvestigation && inspectedFields.has('subject') && currentCard.authStatus && (
                    <span className="text-[10px] text-[var(--c-muted)]">
                      [{currentCard.authStatus}]
                    </span>
                  )}
                </div>
              )
            )}

            {/* BODY */}
            <div className="text-sm text-[var(--c-secondary)] leading-relaxed whitespace-pre-wrap max-h-52 lg:max-h-none overflow-y-auto">
              {currentCard.body}
            </div>
          </div>

          {/* Answer buttons — phishing left, legit right (matches main game) */}
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('phishing')}
              className="flex-1 py-3 term-border text-sm tracking-widest hover:bg-[color-mix(in_srgb,#ff3333_8%,transparent)] active:scale-95 transition-all"
              style={{ color: '#ff3333', borderColor: 'rgba(255,51,51,0.5)' }}
            >
              [ PHISHING ]
            </button>
            <button
              onClick={() => handleAnswer('legit')}
              className="flex-1 py-3 term-border text-sm tracking-widest text-[var(--c-primary)] hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:scale-95 transition-all"
            >
              [ LEGIT ]
            </button>
          </div>

          {/* Back link */}
          <button
            onClick={onBack}
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
