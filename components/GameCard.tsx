'use client';

import { useState, useRef, useCallback } from 'react';
import type { Card, Answer, Confidence } from '@/lib/types';

const SWIPE_THRESHOLD = 75;
const FLY_DISTANCE = 650;
const SPRING_STIFFNESS = 320;
const SPRING_DAMPING = 24;

interface Props {
  card: Card;
  onAnswer: (answer: Answer, confidence: Confidence, timing?: {
    timeFromRenderMs: number;
    timeFromConfidenceMs: number | null;
    confidenceSelectionTimeMs: number | null;
    scrollDepthPct: number;
    answerMethod: 'swipe' | 'button';
  }) => void;
  questionNumber: number;
  total: number;
  streak: number;
  totalScore: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const CONFIDENCE_OPTIONS: { value: Confidence; label: string; multiplier: string; color: string }[] = [
  { value: 'guessing', label: 'GUESSING', multiplier: '1x', color: 'text-[#00aa28] border-[rgba(0,255,65,0.25)]' },
  { value: 'likely',   label: 'LIKELY',   multiplier: '2x', color: 'text-[#ffaa00] border-[rgba(255,170,0,0.5)]' },
  { value: 'certain',  label: 'CERTAIN',  multiplier: '3x', color: 'text-[#00ff41] border-[rgba(0,255,65,0.8)]'  },
];

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function analystFace(streak: number): string {
  if (streak >= 6) return '[^_^]';
  if (streak >= 3) return '[o_o]';
  return '[._.]';
}

function EmailDisplay({ card, onScroll }: { card: Card; onScroll?: (pct: number) => void }) {
  return (
    <div className="term-border bg-[#060c06] select-none">
      <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
        <span className="text-[#00aa28] text-xs tracking-widest">INCOMING_EMAIL</span>
        <span className="text-[#003a0e] text-xs">■ □ □</span>
      </div>
      <div className="px-3 py-2 border-b border-[rgba(0,255,65,0.2)] space-y-1">
        <div className="flex gap-2 text-xs">
          <span className="text-[#00aa28] w-10 shrink-0">FROM:</span>
          <span className="text-[#00ff41] font-mono break-all">{card.from}</span>
        </div>
        {card.subject && (
          <div className="flex gap-2 text-xs">
            <span className="text-[#00aa28] w-10 shrink-0">SUBJ:</span>
            <span className="text-[#00ff41] font-mono">{card.subject}</span>
          </div>
        )}
      </div>
      <div
        className="px-3 py-3 text-xs text-[#00aa28] leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto font-mono"
        onScroll={(e) => {
          const el = e.currentTarget;
          const pct = Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100);
          onScroll?.(pct);
        }}
      >
        {card.body}
      </div>
    </div>
  );
}

function SMSDisplay({ card, onScroll }: { card: Card; onScroll?: (pct: number) => void }) {
  return (
    <div className="term-border bg-[#060c06] select-none">
      <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
        <span className="text-[#00aa28] text-xs tracking-widest">INCOMING_SMS</span>
        <span className="text-[#003a0e] text-xs">■ □ □</span>
      </div>
      <div className="px-3 py-2 border-b border-[rgba(0,255,65,0.2)]">
        <div className="flex gap-2 text-xs">
          <span className="text-[#00aa28] w-10 shrink-0">FROM:</span>
          <span className="text-[#00ff41] font-mono">{card.from}</span>
        </div>
      </div>
      <div
        className="px-3 py-3 text-xs text-[#00aa28] leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto font-mono"
        onScroll={(e) => {
          const el = e.currentTarget;
          const pct = Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100);
          onScroll?.(pct);
        }}
      >
        {card.body}
      </div>
    </div>
  );
}

export function GameCard({ card, onAnswer, questionNumber, total, streak, totalScore, soundEnabled, onToggleSound }: Props) {
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  // dragX drives stamp opacity — updated during drag via React state
  const [dragX, setDragX] = useState(0);
  const [flying, setFlying] = useState(false);

  const renderTime          = useRef<number>(Date.now());
  const confidenceTime      = useRef<number | null>(null);
  const maxScrollDepth      = useRef<number>(0);

  const answered   = useRef(false);
  const dragging   = useRef(false);
  const startX     = useRef(0);
  const posX       = useRef(0);          // current position (mirrors dragX but as a ref)
  const rafId      = useRef<number>(0);
  const cardRef    = useRef<HTMLDivElement>(null);
  const phishRef   = useRef<HTMLDivElement>(null);
  const legitRef   = useRef<HTMLDivElement>(null);

  // Rolling velocity window (last N pointer samples)
  const velSamples = useRef<{ dx: number; dt: number }[]>([]);
  const lastPtr    = useRef<{ x: number; t: number }>({ x: 0, t: 0 });

  // Apply transform + stamp opacities directly to the DOM (no React re-render per frame)
  function applyTransform(x: number) {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `translateX(${x}px) rotate(${x / 22}deg)`;
    const po = clamp(-x / SWIPE_THRESHOLD, 0, 1);
    const lo = clamp(x  / SWIPE_THRESHOLD, 0, 1);
    if (phishRef.current) phishRef.current.style.opacity = String(po);
    if (legitRef.current) legitRef.current.style.opacity = String(lo);
  }

  // Spring snap-back using rAF — no React re-renders during animation
  const springBack = useCallback((fromX: number) => {
    cancelAnimationFrame(rafId.current);
    let pos = fromX;
    let vel = 0;
    const dt = 1 / 60;

    function step() {
      const acc = -SPRING_STIFFNESS * pos - SPRING_DAMPING * vel;
      vel += acc * dt;
      pos += vel * dt;
      applyTransform(pos);

      if (Math.abs(pos) < 0.4 && Math.abs(vel) < 0.4) {
        applyTransform(0);
        setDragX(0);  // sync React state once animation settles
      } else {
        rafId.current = requestAnimationFrame(step);
      }
    }

    rafId.current = requestAnimationFrame(step);
  }, []);

  function fly(direction: 'left' | 'right', conf: Confidence, method: 'swipe' | 'button' = 'button') {
    if (answered.current) return;
    answered.current = true;
    cancelAnimationFrame(rafId.current);
    setFlying(true);
    const now = Date.now();
    const timeFromRender = now - renderTime.current;
    const timeFromConfidence = confidenceTime.current !== null ? now - confidenceTime.current : null;
    const confidenceSelectionTime = confidenceTime.current !== null ? confidenceTime.current - renderTime.current : null;
    setTimeout(() => onAnswer(
      direction === 'left' ? 'phishing' : 'legit',
      conf,
      {
        timeFromRenderMs: timeFromRender,
        timeFromConfidenceMs: timeFromConfidence,
        confidenceSelectionTimeMs: confidenceSelectionTime,
        scrollDepthPct: maxScrollDepth.current,
        answerMethod: method,
      }
    ), 230);
  }

  function getVelocity(): number {
    const samples = velSamples.current;
    if (samples.length === 0) return 0;
    const totalDt = samples.reduce((s, v) => s + v.dt, 0);
    const totalDx = samples.reduce((s, v) => s + v.dx, 0);
    return totalDt > 0 ? totalDx / totalDt : 0;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!confidence || answered.current) return;
    cancelAnimationFrame(rafId.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    posX.current = 0;
    dragging.current = true;
    velSamples.current = [];
    lastPtr.current = { x: e.clientX, t: e.timeStamp };
    if (cardRef.current) cardRef.current.style.transition = 'none';
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || !confidence || answered.current) return;

    // Rolling velocity — keep last ~80ms of samples
    const dt = e.timeStamp - lastPtr.current.t;
    const dx = e.clientX - lastPtr.current.x;
    velSamples.current.push({ dx, dt });
    const cutoff = e.timeStamp - 80;
    // trim old samples inline
    let i = 0;
    let elapsed = 0;
    for (let j = velSamples.current.length - 1; j >= 0; j--) {
      elapsed += velSamples.current[j].dt;
      if (elapsed > 80) { i = j + 1; break; }
    }
    velSamples.current = velSamples.current.slice(i);
    lastPtr.current = { x: e.clientX, t: e.timeStamp };

    const x = e.clientX - startX.current;
    posX.current = x;
    applyTransform(x);
    setDragX(x);  // keep React state in sync for stamp re-renders
  }

  function handlePointerUp() {
    if (!dragging.current || !confidence || answered.current) return;
    dragging.current = false;

    const x = posX.current;
    const vx = getVelocity();  // px/ms
    velSamples.current = [];

    const shouldFly = Math.abs(x) > SWIPE_THRESHOLD || Math.abs(vx) > 0.4;

    if (shouldFly) {
      fly(x > 0 || vx > 0 ? 'right' : 'left', confidence, 'swipe');
    } else {
      // Restore transition then spring back
      if (cardRef.current) cardRef.current.style.transition = '';
      springBack(x);
    }
  }

  function handleButton(answer: Answer) {
    if (!confidence || answered.current) return;
    fly(answer === 'phishing' ? 'left' : 'right', confidence, 'button');
  }

  const progress = ((questionNumber - 1) / total) * 100;
  const streakAtBonus = streak > 0 && streak % 3 === 0;

  // Stamp opacity driven by React dragX state (updated during drag and reset after spring)
  const phishingOpacity = clamp(-dragX / SWIPE_THRESHOLD, 0, 1);
  const legitOpacity    = clamp(dragX  / SWIPE_THRESHOLD, 0, 1);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm px-4">
      {/* HUD */}
      <div className="w-full flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-[#00aa28]">
            Q<span className="text-[#00ff41] glow">{questionNumber}</span>/{total}
          </span>
          <span className={`text-xs px-2 py-0.5 border font-mono ${
            card.difficulty === 'easy'   ? 'text-[#00ff41] border-[rgba(0,255,65,0.4)]' :
            card.difficulty === 'medium' ? 'text-[#ffaa00] border-[rgba(255,170,0,0.4)]' :
                                           'text-[#ff3333] border-[rgba(255,51,51,0.4)]'
          }`}>
            {card.difficulty.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[#00aa28] ${streakAtBonus ? 'glow text-[#00ff41]' : ''}`}>
            STREAK:<span className="text-[#00ff41]">{streak}</span>
          </span>
          <span className="text-[#00aa28]">PTS:<span className="text-[#00ff41] glow">{totalScore}</span></span>
          <button
            onClick={onToggleSound}
            className={`font-mono text-[10px] transition-colors ${soundEnabled ? 'text-[#00ff41]' : 'text-[#00aa28]'}`}
          >
            {soundEnabled ? '[SFX]' : '[SFX OFF]'}
          </button>
          <span className="text-[#003a0e] font-mono text-sm">{analystFace(streak)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-px bg-[#003a0e] relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-[#00ff41] transition-all duration-300"
          style={{ width: `${progress}%`, boxShadow: '0 0 6px rgba(0,255,65,0.8)' }}
        />
      </div>

      {confidence && (
        <div className="flex justify-between w-full text-xs text-[#003a0e] font-mono tracking-wider">
          <span>← PHISHING</span>
          <span>LEGIT →</span>
        </div>
      )}

      {/* Card */}
      <div className="relative w-full">
        {/* Stamp overlays — driven by dragX React state */}
        {confidence && (
          <>
            <div
              ref={phishRef}
              className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
              style={{ opacity: phishingOpacity }}
            >
              <div className="border-2 border-[#ff3333] px-3 py-1 -rotate-12 bg-[rgba(255,51,51,0.08)]">
                <span className="text-[#ff3333] text-lg font-black tracking-widest glow-red">PHISHING</span>
              </div>
            </div>
            <div
              ref={legitRef}
              className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
              style={{ opacity: legitOpacity }}
            >
              <div className="border-2 border-[#00ff41] px-3 py-1 rotate-12 bg-[rgba(0,255,65,0.08)]">
                <span className="text-[#00ff41] text-lg font-black tracking-widest glow">LEGIT</span>
              </div>
            </div>
          </>
        )}

        <div
          ref={cardRef}
          onPointerDown={confidence ? handlePointerDown : undefined}
          onPointerMove={confidence ? handlePointerMove : undefined}
          onPointerUp={confidence ? handlePointerUp : undefined}
          onPointerCancel={confidence ? handlePointerUp : undefined}
          className={`anim-card-entry touch-none ${confidence ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{
            transform: 'translateX(0px) rotate(0deg)',
            opacity: flying ? 0 : 1,
            transition: flying ? 'transform 0.23s ease-in, opacity 0.23s ease-in' : '',
            willChange: 'transform',
          }}
        >
          {card.type === 'email'
            ? <EmailDisplay card={card} onScroll={(pct) => { maxScrollDepth.current = Math.max(maxScrollDepth.current, pct); }} />
            : <SMSDisplay card={card} onScroll={(pct) => { maxScrollDepth.current = Math.max(maxScrollDepth.current, pct); }} />
          }
        </div>
      </div>

      {/* Controls */}
      {!confidence ? (
        <div className="w-full space-y-2">
          <div className="text-xs text-[#00aa28] font-mono text-center tracking-widest">
            — SET CONFIDENCE BEFORE ANSWERING —
          </div>
          <div className="flex gap-2">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setConfidence(opt.value); confidenceTime.current = Date.now(); }}
                className={`flex-1 py-3 term-border font-mono text-xs tracking-wider transition-all active:scale-95 hover:bg-[rgba(0,255,65,0.06)] flex flex-col items-center gap-0.5 ${opt.color}`}
              >
                <span>{opt.label}</span>
                <span className="text-[10px] opacity-60">{opt.multiplier} PTS</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full space-y-2">
          <div className="text-xs text-[#00aa28] font-mono text-center tracking-widest">
            CONFIDENCE: <span className="text-[#00ff41] glow">{confidence.toUpperCase()}</span>
            {' · '}
            {confidence === 'certain' ? '3x' : confidence === 'likely' ? '2x' : '1x'} PTS
            <button
              onClick={() => { if (!answered.current) { setConfidence(null); setDragX(0); confidenceTime.current = null; } }}
              className="ml-3 text-[#003a0e] hover:text-[#00aa28] transition-colors"
            >
              [change]
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleButton('phishing')}
              className="flex-1 py-4 border border-[rgba(255,51,51,0.5)] text-[#ff3333] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,51,51,0.1)] active:scale-95 transition-all glow-red"
            >
              PHISHING
            </button>
            <button
              onClick={() => handleButton('legit')}
              className="flex-1 py-4 border border-[rgba(0,255,65,0.5)] text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.1)] active:scale-95 transition-all glow"
            >
              LEGIT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
