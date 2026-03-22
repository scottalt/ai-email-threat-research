'use client';

import { useState, useRef, useEffect } from 'react';
import type { DealCard, Answer, Confidence, GameMode } from '@/lib/types';
import type { SafeDealCard } from '@/lib/card-utils';

import { parseFrom } from '@/lib/parseFrom';

interface Props {
  card: DealCard | SafeDealCard;
  onAnswer: (answer: Answer, confidence: Confidence, timing?: {
    timeFromRenderMs: number;
    timeFromConfidenceMs: number | null;
    confidenceSelectionTimeMs: number | null;
    scrollDepthPct: number;
    answerMethod: 'button';
    headersOpened: boolean;
    urlInspected: boolean;
  }) => void;
  questionNumber: number;
  total: number;
  streak: number;
  totalScore: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onQuit: () => void;
  mode?: GameMode;
}

const CONFIDENCE_OPTIONS: { value: Confidence; label: string; multiplier: string; color: string }[] = [
  { value: 'guessing', label: 'GUESSING', multiplier: '1x', color: 'text-[var(--c-secondary)] border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)]' },
  { value: 'likely',   label: 'LIKELY',   multiplier: '2x', color: 'text-[#ffaa00] border-[rgba(255,170,0,0.5)]' },
  { value: 'certain',  label: 'CERTAIN',  multiplier: '3x', color: 'text-[var(--c-primary)] border-[color-mix(in_srgb,var(--c-primary)_80%,transparent)]'  },
];

function analystFace(streak: number): string {
  if (streak >= 6) return '[^_^]';
  if (streak >= 3) return '[o_o]';
  return '[._.]';
}


type Segment =
  | { type: 'text'; content: string }
  | { type: 'url'; display: string; actual: string };

function parseBody(text: string): Segment[] {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s]+)/g;
  const segments: Segment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: text.slice(last, match.index) });
    }
    if (match[1] && match[2]) {
      segments.push({ type: 'url', display: match[1], actual: match[2] });
    } else {
      segments.push({ type: 'url', display: match[3], actual: match[3] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: 'text', content: text.slice(last) });
  }
  return segments;
}

function EmailDisplay({ card, onScroll, onUrlInspected }: {
  card: DealCard | SafeDealCard;
  onScroll?: (pct: number) => void;
  onUrlInspected?: () => void;
}) {
  const [inspectedUrl, setInspectedUrl] = useState<string | null>(null);
  const [showFromEmail, setShowFromEmail] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyOverflows, setBodyOverflows] = useState(false);

  // Callback ref: scroll URL inspector into view when it mounts
  const urlInspectorRef = (el: HTMLDivElement | null) => {
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };

  function toggleUrl(url: string) {
    onUrlInspected?.();
    setInspectedUrl((prev) => prev === url ? null : url);
  }

  const segments = parseBody(card.body);
  const { displayName, email } = parseFrom(card.from);

  // Detect if body content overflows the max-height
  useEffect(() => {
    const el = bodyRef.current;
    if (el) setBodyOverflows(el.scrollHeight > el.clientHeight);
  }, [card.body]);

  return (
    <div className="term-border bg-[var(--c-bg)] select-none scanline">
      <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2 flex items-center justify-between">
        <span className="text-[var(--c-secondary)] text-sm tracking-widest">INCOMING_EMAIL</span>
        <span className="text-[var(--c-dark)] text-sm font-mono">■ □ □</span>
      </div>
      <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] space-y-1">
        <div className="flex gap-2 text-sm">
          <span className="text-[var(--c-secondary)] w-10 shrink-0">FROM:</span>
          <span className="text-[var(--c-primary)] font-mono">
            {displayName ? (
              <>
                <span className="break-all">{displayName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFromEmail((o) => !o); }}
                  className="ml-1 text-sm text-[var(--c-dark)] hover:text-[#ffaa00] transition-colors"
                  aria-label={showFromEmail ? 'Hide sender email address' : 'Show sender email address'}
                >
                  {showFromEmail ? '[−]' : '[↗]'}
                </button>
                {showFromEmail && (
                  <span className="block text-[#ffaa00] text-sm break-all mt-0.5">&lt;{email}&gt;</span>
                )}
              </>
            ) : (
              <span className="break-all">{email}</span>
            )}
          </span>
        </div>
        {card.subject && (
          <div className="flex gap-2 text-sm">
            <span className="text-[var(--c-secondary)] w-10 shrink-0">SUBJ:</span>
            <span className="text-[var(--c-primary)] font-mono">{card.subject}</span>
          </div>
        )}
        {card.attachmentName && (
          <div className="flex gap-2 text-sm">
            <span className="text-[var(--c-secondary)] w-10 shrink-0">ATCH:</span>
            <span className="text-[#ffaa00] font-mono">📎 {card.attachmentName}</span>
          </div>
        )}
      </div>
      <div className="relative">
        <div
          ref={bodyRef}
          className={`px-3 py-3 text-sm text-[var(--c-secondary)] leading-relaxed whitespace-pre-wrap font-mono ${bodyExpanded ? '' : 'max-h-52 lg:max-h-none momentum-scroll lg:overflow-auto scroll-fade-bottom lg:scroll-fade-none'}`}
          onScroll={(e) => {
            const el = e.currentTarget;
            const pct = Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100);
            onScroll?.(pct);
          }}
        >
          {segments.map((seg, i) =>
            seg.type === 'url' ? (
              <span
                key={i}
                className="text-[#ffaa00] underline cursor-pointer hover:text-[#ffcc44] transition-colors"
                onClick={(e) => { e.stopPropagation(); toggleUrl(seg.actual); }}
              >
                {seg.display}<span className="opacity-50 text-sm ml-0.5">{inspectedUrl === seg.actual ? '[−]' : '[↗]'}</span>
              </span>
            ) : (
              <span key={i}>{seg.content}</span>
            )
          )}
        </div>
        {(bodyOverflows || bodyExpanded) && (
          <button
            onClick={(e) => { e.stopPropagation(); setBodyExpanded((o) => !o); }}
            className="lg:hidden w-full py-1.5 border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-[var(--c-muted)] hover:text-[var(--c-secondary)] text-xs font-mono tracking-widest transition-colors"
          >
            {bodyExpanded ? '[ COLLAPSE ]' : '[ EXPAND ]'}
          </button>
        )}
      </div>
      {inspectedUrl && (
        <div ref={urlInspectorRef} className="border-t border-[rgba(255,170,0,0.3)] px-3 py-2 bg-[rgba(255,170,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#ffaa00] text-sm font-mono tracking-widest">URL_INSPECTOR</span>
            <button onClick={() => setInspectedUrl(null)} className="text-[var(--c-dark)] text-sm font-mono hover:text-[var(--c-secondary)] transition-colors p-2 -m-2" aria-label="Close URL inspector">[ × ]</button>
          </div>
          <span className="text-[#ffaa00] font-mono text-sm break-all">{inspectedUrl}</span>
        </div>
      )}
    </div>
  );
}

function SMSDisplay({ card, onScroll, onUrlInspected }: {
  card: DealCard | SafeDealCard;
  onScroll?: (pct: number) => void;
  onUrlInspected?: () => void;
}) {
  const [inspectedUrl, setInspectedUrl] = useState<string | null>(null);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyOverflows, setBodyOverflows] = useState(false);

  // Callback ref: scroll URL inspector into view when it mounts
  const urlInspectorRef = (el: HTMLDivElement | null) => {
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };

  function toggleUrl(url: string) {
    onUrlInspected?.();
    setInspectedUrl((prev) => prev === url ? null : url);
  }

  const segments = parseBody(card.body);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) setBodyOverflows(el.scrollHeight > el.clientHeight);
  }, [card.body]);

  return (
    <div className="term-border bg-[var(--c-bg)] select-none scanline">
      <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2 flex items-center justify-between">
        <span className="text-[var(--c-secondary)] text-sm tracking-widest">INCOMING_SMS</span>
        <span className="text-[var(--c-dark)] text-sm font-mono">■ □ □</span>
      </div>
      <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]">
        <div className="flex gap-2 text-sm">
          <span className="text-[var(--c-secondary)] w-10 shrink-0">FROM:</span>
          <span className="text-[var(--c-primary)] font-mono">{card.from}</span>
        </div>
      </div>
      <div className="relative">
        <div
          ref={bodyRef}
          className={`px-3 py-3 text-sm text-[var(--c-secondary)] leading-relaxed whitespace-pre-wrap font-mono ${bodyExpanded ? '' : 'max-h-52 lg:max-h-none momentum-scroll lg:overflow-auto scroll-fade-bottom lg:scroll-fade-none'}`}
          onScroll={(e) => {
            const el = e.currentTarget;
            const pct = Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100);
            onScroll?.(pct);
          }}
        >
          {segments.map((seg, i) =>
            seg.type === 'url' ? (
              <span
                key={i}
                className="text-[#ffaa00] underline cursor-pointer hover:text-[#ffcc44] transition-colors"
                onClick={(e) => { e.stopPropagation(); toggleUrl(seg.actual); }}
              >
                {seg.display}<span className="opacity-50 text-sm ml-0.5">{inspectedUrl === seg.actual ? '[−]' : '[↗]'}</span>
              </span>
            ) : (
              <span key={i}>{seg.content}</span>
            )
          )}
        </div>
        {(bodyOverflows || bodyExpanded) && (
          <button
            onClick={(e) => { e.stopPropagation(); setBodyExpanded((o) => !o); }}
            className="lg:hidden w-full py-1.5 border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] text-[var(--c-muted)] hover:text-[var(--c-secondary)] text-xs font-mono tracking-widest transition-colors"
          >
            {bodyExpanded ? '[ COLLAPSE ]' : '[ EXPAND ]'}
          </button>
        )}
      </div>
      {inspectedUrl && (
        <div ref={urlInspectorRef} className="border-t border-[rgba(255,170,0,0.3)] px-3 py-2 bg-[rgba(255,170,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#ffaa00] text-sm font-mono tracking-widest">URL_INSPECTOR</span>
            <button onClick={() => setInspectedUrl(null)} className="text-[var(--c-dark)] text-sm font-mono hover:text-[var(--c-secondary)] transition-colors p-2 -m-2" aria-label="Close URL inspector">[ × ]</button>
          </div>
          <span className="text-[#ffaa00] font-mono text-sm break-all">{inspectedUrl}</span>
        </div>
      )}
    </div>
  );
}

export function GameCard({ card, onAnswer, questionNumber, total, streak, totalScore, soundEnabled, onToggleSound, onQuit, mode }: Props) {
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [flying, setFlying] = useState(false);

  const renderTime          = useRef<number>(Date.now());
  const confidenceTime      = useRef<number | null>(null);
  const maxScrollDepth      = useRef<number>(0);
  const headersEverOpened   = useRef(false);
  const urlEverInspected    = useRef(false);
  const answered            = useRef(false);

  function handleButton(answer: Answer) {
    if (!confidence || answered.current) return;
    answered.current = true;
    setFlying(true);
    const now = Date.now();
    const timeFromRender = now - renderTime.current;
    const timeFromConfidence = confidenceTime.current !== null ? now - confidenceTime.current : null;
    const confidenceSelectionTime = confidenceTime.current !== null ? confidenceTime.current - renderTime.current : null;
    setTimeout(() => onAnswer(
      answer,
      confidence,
      {
        timeFromRenderMs: timeFromRender,
        timeFromConfidenceMs: timeFromConfidence,
        confidenceSelectionTimeMs: confidenceSelectionTime,
        scrollDepthPct: maxScrollDepth.current,
        answerMethod: 'button',
        headersOpened: headersEverOpened.current,
        urlInspected: urlEverInspected.current,
      }
    ), 230);
  }

  const streakAtBonus = streak > 0 && streak % 3 === 0;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm lg:max-w-lg px-4 pb-safe">
      {/* HUD */}
      <div className="w-full flex flex-wrap items-center justify-between gap-y-1 text-sm font-mono">
        <div className="flex items-center gap-2">
          <button
            onClick={onQuit}
            className="text-[var(--c-dark)] text-sm font-mono hover:text-[#ff3333] transition-colors p-2 -m-2"
            aria-label="Quit game"
          >
            [QUIT]
          </button>
          {mode === 'research' && (
            <span className="text-[var(--c-accent)] text-sm font-mono">[RES]</span>
          )}
          <span className="font-mono text-sm">
            <span className="text-[var(--c-dark)]">[</span>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                style={{
                  color: i < questionNumber - 1 ? 'var(--c-primary)' : 'var(--c-dark)',
                }}
              >▓</span>
            ))}
            <span className="text-[var(--c-dark)]">]</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[var(--c-secondary)] ${streakAtBonus ? 'text-[var(--c-primary)]' : ''}`}>
            STREAK:<span className="text-[var(--c-primary)]">{streak}</span>
          </span>
          <span className="text-[var(--c-secondary)]">PTS:<span className="text-[var(--c-primary)]">{totalScore}</span></span>
          <button
            onClick={onToggleSound}
            className={`font-mono text-sm transition-colors p-2 -m-2 ${soundEnabled ? 'text-[var(--c-primary)]' : 'text-[var(--c-secondary)]'}`}
          >
            {soundEnabled ? '[SFX]' : '[SFX OFF]'}
          </button>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full anim-card-entry"
        style={{
          opacity: flying ? 0 : 1,
          transition: flying ? 'opacity 0.23s ease-in' : '',
        }}
      >
        {card.type === 'email'
          ? <EmailDisplay
              card={card}
              onScroll={(pct) => { maxScrollDepth.current = Math.max(maxScrollDepth.current, pct); }}
              onUrlInspected={() => { urlEverInspected.current = true; }}
            />
          : <SMSDisplay
              card={card}
              onScroll={(pct) => { maxScrollDepth.current = Math.max(maxScrollDepth.current, pct); }}
              onUrlInspected={() => { urlEverInspected.current = true; }}
            />
        }
      </div>

      {/* Controls */}
      {!confidence ? (
        <div className="w-full space-y-2">
          <div className="text-sm text-[var(--c-secondary)] font-mono text-center tracking-widest">
            — SET CONFIDENCE BEFORE ANSWERING —
          </div>
          <div className="flex gap-2">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setConfidence(opt.value); confidenceTime.current = Date.now(); }}
                className={`flex-1 py-3 term-border font-mono text-sm tracking-wider transition-all active:scale-95 hover:bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)] flex flex-col items-center gap-0.5 ${opt.color}`}
              >
                <span>{opt.label}</span>
                <span className="text-sm opacity-60">{opt.multiplier} PTS</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full space-y-2">
          <div className="text-sm text-[var(--c-secondary)] font-mono text-center tracking-widest">
            CONFIDENCE: <span className="text-[var(--c-primary)]">{confidence.toUpperCase()}</span>
            {' · '}
            {confidence === 'certain' ? '3x' : confidence === 'likely' ? '2x' : '1x'} PTS
            <button
              onClick={() => { if (!answered.current) { setConfidence(null); confidenceTime.current = null; } }}
              className="ml-3 text-[var(--c-dark)] hover:text-[var(--c-secondary)] transition-colors"
              aria-label="Change confidence level"
            >
              [change]
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleButton('phishing')}
              className="flex-1 py-4 border border-[rgba(255,51,51,0.5)] text-[#ff3333] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,51,51,0.1)] active:scale-95 transition-all"
            >
              PHISHING
            </button>
            <button
              onClick={() => handleButton('legit')}
              className="flex-1 py-4 border border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] active:scale-95 transition-all"
            >
              LEGIT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
