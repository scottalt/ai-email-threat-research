'use client';

import { useState, useRef } from 'react';
import type { DealCard, Answer, Confidence, GameMode } from '@/lib/types';

import { parseFrom } from '@/lib/parseFrom';

interface Props {
  card: DealCard;
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
  { value: 'guessing', label: 'GUESSING', multiplier: '1x', color: 'text-[#00aa28] border-[rgba(0,255,65,0.25)]' },
  { value: 'likely',   label: 'LIKELY',   multiplier: '2x', color: 'text-[#ffaa00] border-[rgba(255,170,0,0.5)]' },
  { value: 'certain',  label: 'CERTAIN',  multiplier: '3x', color: 'text-[#00ff41] border-[rgba(0,255,65,0.8)]'  },
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

function EmailDisplay({ card, onScroll, onHeadersOpened, onUrlInspected }: {
  card: DealCard;
  onScroll?: (pct: number) => void;
  onHeadersOpened?: () => void;
  onUrlInspected?: () => void;
}) {
  const [inspectedUrl, setInspectedUrl] = useState<string | null>(null);
  const [headersOpen, setHeadersOpen] = useState(false);
  const [showFromEmail, setShowFromEmail] = useState(false);
  const segments = parseBody(card.body);
  const { displayName, email } = parseFrom(card.from);

  const headers = (() => {
    if (card.authStatus === 'verified') {
      return {
        spf: 'PASS', dkim: 'PASS', dmarc: 'PASS',
        replyTo: card.replyTo ?? card.from, returnPath: `<${card.from}>`,
        color: { spf: '#00aa28', dkim: '#00aa28', dmarc: '#00aa28' },
      };
    }
    if (card.authStatus === 'fail') {
      return {
        spf: 'FAIL', dkim: 'FAIL', dmarc: 'FAIL',
        replyTo: card.replyTo ?? card.from, returnPath: `<${card.from}>`,
        color: { spf: '#ff3333', dkim: '#ff3333', dmarc: '#ff3333' },
      };
    }
    // unverified
    return {
      spf: 'NONE', dkim: 'NONE', dmarc: 'NONE',
      replyTo: card.replyTo ?? card.from, returnPath: `<${card.from}>`,
      color: { spf: '#ffaa00', dkim: '#ffaa00', dmarc: '#ffaa00' },
    };
  })();

  return (
    <div className="term-border bg-[#060c06] select-none scanline">
      <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
        <span className="text-[#00aa28] text-sm tracking-widest">INCOMING_EMAIL</span>
        <button
          onClick={(e) => { e.stopPropagation(); if (!headersOpen) onHeadersOpened?.(); setHeadersOpen((o) => !o); }}
          className="text-[#00aa28] text-sm font-mono hover:text-[#00ff41] transition-colors p-2 -m-2"
          aria-label={headersOpen ? 'Close email headers' : 'View email headers'}
        >
          [HEADERS]
        </button>
      </div>
      <div className="px-3 py-2 border-b border-[rgba(0,255,65,0.2)] space-y-1">
        <div className="flex gap-2 text-sm">
          <span className="text-[#00aa28] w-10 shrink-0">FROM:</span>
          <span className="text-[#00ff41] font-mono">
            {displayName ? (
              <>
                <span className="break-all">{displayName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFromEmail((o) => !o); }}
                  className="ml-1 text-sm text-[#003a0e] hover:text-[#ffaa00] transition-colors"
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
            <span className="text-[#00aa28] w-10 shrink-0">SUBJ:</span>
            <span className="text-[#00ff41] font-mono">{card.subject}</span>
          </div>
        )}
        {card.sentAt && (
          <div className="flex gap-2 text-sm">
            <span className="text-[#00aa28] w-10 shrink-0">SENT:</span>
            <span className="text-[#00ff41] font-mono text-sm">{card.sentAt}</span>
          </div>
        )}
        {card.attachmentName && (
          <div className="flex gap-2 text-sm">
            <span className="text-[#00aa28] w-10 shrink-0">ATCH:</span>
            <span className="text-[#ffaa00] font-mono">📎 {card.attachmentName}</span>
          </div>
        )}
      </div>
      {headersOpen && (
        <div className="border-b border-[rgba(0,255,65,0.2)] px-3 py-2 bg-[rgba(0,255,65,0.02)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#ffaa00] text-sm font-mono tracking-widest">HEADERS</span>
            <button
              onClick={(e) => { e.stopPropagation(); setHeadersOpen(false); }}
              className="text-[#003a0e] text-sm font-mono hover:text-[#00aa28] transition-colors"
              aria-label="Close headers"
            >
              [ × ]
            </button>
          </div>
          <div className="space-y-1 text-sm font-mono">
            <div className="flex gap-2">
              <span className="text-[#00aa28] w-14 shrink-0">SPF:</span>
              <span style={{ color: headers.color.spf }}>{headers.spf}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#00aa28] w-14 shrink-0">DKIM:</span>
              <span style={{ color: headers.color.dkim }}>{headers.dkim}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#00aa28] w-14 shrink-0">DMARC:</span>
              <span style={{ color: headers.color.dmarc }}>{headers.dmarc}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#00aa28] w-14 shrink-0">Reply-To:</span>
              <span className="text-[#00ff41] break-all">{headers.replyTo}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#00aa28] w-14 shrink-0">Ret-Path:</span>
              <span className="text-[#00ff41] break-all">{headers.returnPath}</span>
            </div>
          </div>
        </div>
      )}
      <div className="relative">
        <div
          className="px-3 py-3 text-sm text-[#00aa28] leading-relaxed whitespace-pre-wrap max-h-52 momentum-scroll font-mono scroll-fade-bottom"
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
                onClick={(e) => { e.stopPropagation(); onUrlInspected?.(); setInspectedUrl(seg.actual); }}
              >
                {seg.display}<span className="opacity-50 text-sm ml-0.5">[↗]</span>
              </span>
            ) : (
              <span key={i}>{seg.content}</span>
            )
          )}
        </div>
      </div>
      {inspectedUrl && (
        <div className="border-t border-[rgba(255,170,0,0.3)] px-3 py-2 bg-[rgba(255,170,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#ffaa00] text-sm font-mono tracking-widest">URL_INSPECTOR</span>
            <button onClick={() => setInspectedUrl(null)} className="text-[#003a0e] text-sm font-mono hover:text-[#00aa28] transition-colors p-2 -m-2" aria-label="Close URL inspector">[ × ]</button>
          </div>
          <span className="text-[#ffaa00] font-mono text-sm break-all">{inspectedUrl}</span>
        </div>
      )}
    </div>
  );
}

function SMSDisplay({ card, onScroll, onUrlInspected }: {
  card: DealCard;
  onScroll?: (pct: number) => void;
  onUrlInspected?: () => void;
}) {
  const [inspectedUrl, setInspectedUrl] = useState<string | null>(null);
  const segments = parseBody(card.body);

  return (
    <div className="term-border bg-[#060c06] select-none scanline">
      <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
        <span className="text-[#00aa28] text-sm tracking-widest">INCOMING_SMS</span>
        <span className="text-[#003a0e] text-sm font-mono">■ □ □</span>
      </div>
      <div className="px-3 py-2 border-b border-[rgba(0,255,65,0.2)]">
        <div className="flex gap-2 text-sm">
          <span className="text-[#00aa28] w-10 shrink-0">FROM:</span>
          <span className="text-[#00ff41] font-mono">{card.from}</span>
        </div>
      </div>
      <div className="relative">
        <div
          className="px-3 py-3 text-sm text-[#00aa28] leading-relaxed whitespace-pre-wrap max-h-52 momentum-scroll font-mono scroll-fade-bottom"
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
                onClick={(e) => { e.stopPropagation(); onUrlInspected?.(); setInspectedUrl(seg.actual); }}
              >
                {seg.display}<span className="opacity-50 text-sm ml-0.5">[↗]</span>
              </span>
            ) : (
              <span key={i}>{seg.content}</span>
            )
          )}
        </div>
      </div>
      {inspectedUrl && (
        <div className="border-t border-[rgba(255,170,0,0.3)] px-3 py-2 bg-[rgba(255,170,0,0.04)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#ffaa00] text-sm font-mono tracking-widest">URL_INSPECTOR</span>
            <button onClick={() => setInspectedUrl(null)} className="text-[#003a0e] text-sm font-mono hover:text-[#00aa28] transition-colors p-2 -m-2" aria-label="Close URL inspector">[ × ]</button>
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
    <div className="flex flex-col items-center gap-4 w-full max-w-sm px-4 pb-safe">
      {/* HUD */}
      <div className="w-full flex flex-wrap items-center justify-between gap-y-1 text-sm font-mono">
        <div className="flex items-center gap-2">
          <button
            onClick={onQuit}
            className="text-[#003a0e] text-sm font-mono hover:text-[#ff3333] transition-colors p-2 -m-2"
            aria-label="Quit game"
          >
            [QUIT]
          </button>
          {mode === 'research' && (
            <span className="text-[#ffaa00] text-sm font-mono">[RES]</span>
          )}
          <span className="font-mono text-sm">
            <span className="text-[#003a0e]">[</span>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                style={{
                  color: i < questionNumber - 1 ? '#00ff41' : '#003a0e',
                }}
              >▓</span>
            ))}
            <span className="text-[#003a0e]">]</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[#00aa28] ${streakAtBonus ? 'text-[#00ff41]' : ''}`}>
            STREAK:<span className="text-[#00ff41]">{streak}</span>
          </span>
          <span className="text-[#00aa28]">PTS:<span className="text-[#00ff41]">{totalScore}</span></span>
          <button
            onClick={onToggleSound}
            className={`font-mono text-sm transition-colors p-2 -m-2 ${soundEnabled ? 'text-[#00ff41]' : 'text-[#00aa28]'}`}
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
              onHeadersOpened={() => { headersEverOpened.current = true; }}
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
          <div className="text-sm text-[#00aa28] font-mono text-center tracking-widest">
            — SET CONFIDENCE BEFORE ANSWERING —
          </div>
          <div className="flex gap-2">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setConfidence(opt.value); confidenceTime.current = Date.now(); }}
                className={`flex-1 py-3 term-border font-mono text-sm tracking-wider transition-all active:scale-95 hover:bg-[rgba(0,255,65,0.06)] flex flex-col items-center gap-0.5 ${opt.color}`}
              >
                <span>{opt.label}</span>
                <span className="text-sm opacity-60">{opt.multiplier} PTS</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full space-y-2">
          <div className="text-sm text-[#00aa28] font-mono text-center tracking-widest">
            CONFIDENCE: <span className="text-[#00ff41]">{confidence.toUpperCase()}</span>
            {' · '}
            {confidence === 'certain' ? '3x' : confidence === 'likely' ? '2x' : '1x'} PTS
            <button
              onClick={() => { if (!answered.current) { setConfidence(null); confidenceTime.current = null; } }}
              className="ml-3 text-[#003a0e] hover:text-[#00aa28] transition-colors"
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
              className="flex-1 py-4 border border-[rgba(0,255,65,0.5)] text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.1)] active:scale-95 transition-all"
            >
              LEGIT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
