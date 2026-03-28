'use client';

import { useEffect, useState } from 'react';
import type { RoundResult, GameMode } from '@/lib/types';
import { XP_PER_CORRECT } from '@/lib/xp';
import { highlightBody } from '@/lib/highlightBody';
import { parseFrom } from '@/lib/parseFrom';

interface Props {
  result: RoundResult;
  streak: number;
  totalScore: number;
  onNext: () => void;
  questionNumber: number;
  total: number;
  sessionId: string;
  mode: GameMode;
}

const CONFIDENCE_LABEL = { guessing: 'GUESSING', likely: 'LIKELY', certain: 'CERTAIN' };
const CONFIDENCE_MULTI = { guessing: '1x', likely: '2x', certain: '3x' };

type BodySegment =
  | { type: 'text'; content: string }
  | { type: 'url'; display: string; actual: string };

function parseBodySegments(text: string): BodySegment[] {
  const urlRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s]+)/g;
  const segments: BodySegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', content: text.slice(last, m.index) });
    if (m[1] && m[2]) segments.push({ type: 'url', display: m[1], actual: m[2] });
    else segments.push({ type: 'url', display: m[3], actual: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) });
  return segments;
}

export function FeedbackCard({ result, streak, totalScore, onNext, questionNumber, total, sessionId, mode }: Props) {
  const { card, correct, userAnswer, confidence, pointsEarned } = result;
  const xpMultiplier = mode === 'expert' ? 2 : 1;
  const xpThisAnswer = correct ? XP_PER_CORRECT * xpMultiplier : 0;
  const wasPhishing = card.isPhishing;
  const streakMilestone = streak > 0 && streak % 3 === 0;

  const [showFlash, setShowFlash] = useState(true);
  const [showFlag, setShowFlag] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagComment, setFlagComment] = useState('');
  const [flagDone, setFlagDone] = useState(false);
  const [displayedHeadline, setDisplayedHeadline] = useState('');
  const [headlineDone, setHeadlineDone] = useState(false);
  const [inspectedUrl, setInspectedUrl] = useState<string | null>(null);
  const [showSignals, setShowSignals] = useState(false);
  const [showClues, setShowClues] = useState(false);

  const headline = correct
    ? wasPhishing ? 'THREAT NEUTRALIZED' : 'ASSET CLEARED'
    : wasPhishing ? 'BREACH DETECTED' : 'FALSE POSITIVE';

  useEffect(() => {
    const t = setTimeout(() => setShowFlash(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setDisplayedHeadline('');
    setHeadlineDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedHeadline(headline.slice(0, i));
      if (i >= headline.length) {
        clearInterval(interval);
        setHeadlineDone(true);
      }
    }, 35);
    return () => clearInterval(interval);
  }, [headline]);

  const headlineColor = correct ? 'text-[var(--c-primary)]' : 'text-[#ff3333]';
  const headlineGlow = '';

  return (
    <div className="w-full max-w-sm lg:max-w-4xl px-4 pb-safe relative">
      {showFlash && (
        <div
          className={`fixed inset-0 pointer-events-none z-50 ${
            correct ? 'bg-[color-mix(in_srgb,var(--c-primary)_7%,transparent)] clear-overlay' : 'bg-[rgba(255,0,0,0.12)] breach-overlay'
          }`}
        />
      )}

      <div className="anim-fade-in-up flex flex-col gap-4">
        {/* Two-column on desktop: left = result/score, right = email review */}
        <div className="flex flex-col lg:flex-row gap-4">
        {/* Left column: result + score */}
        <div className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0">
        {/* Result header */}
        <div className={`term-border bg-[var(--c-bg)] ${correct ? 'border-[color-mix(in_srgb,var(--c-primary)_60%,transparent)]' : 'border-[rgba(255,51,51,0.6)]'} ${!correct ? 'anim-glitch' : ''}`}>
          <div className={`border-b px-3 py-2 flex items-center justify-between ${correct ? 'border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)]' : 'border-[rgba(255,51,51,0.4)]'}`}>
            <span className={`text-sm font-mono tracking-widest ${correct ? 'text-[var(--c-primary)]' : 'text-[#ff3333]'}`}>
              ANALYSIS_RESULT
            </span>
            <span className="text-sm font-mono text-[var(--c-dark)]">Q{questionNumber}/{total}</span>
          </div>
          <div className="px-3 py-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-3">
              <div className={`text-2xl font-black font-mono tracking-widest ${headlineColor} ${headlineGlow}`}>
                {displayedHeadline}{!headlineDone && <span className="cursor" />}
              </div>
              {headlineDone && (
                <span className={`text-sm font-mono ${correct ? 'text-[var(--c-secondary)]' : 'text-[#aa2222]'}`}>
                  {correct ? (streak >= 6 ? '[^_^]' : streak >= 3 ? '[o_o]' : '[._.]') : '[x_x]'}
                </span>
              )}
            </div>
            <div className="text-sm font-mono text-[var(--c-secondary)]">
              {wasPhishing
                ? `This was a PHISHING attempt. You said: ${userAnswer.toUpperCase()}.`
                : `This was LEGIT. You said: ${userAnswer.toUpperCase()}.`}
            </div>
          </div>
          <div className={`border-t px-3 py-2 flex items-center justify-between ${correct ? 'border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)]' : 'border-[rgba(255,51,51,0.25)]'}`}>
            <span className="text-sm font-mono text-[var(--c-secondary)]">
              CONFIDENCE: <span className="text-[var(--c-primary)]">{CONFIDENCE_LABEL[confidence]}</span>
              {' '}({CONFIDENCE_MULTI[confidence]})
            </span>
            <span className="text-sm font-mono">
              {xpThisAnswer > 0 ? (
                <span className="text-[var(--c-primary)]">+{xpThisAnswer} XP</span>
              ) : (
                <span className="text-[var(--c-dark)]">+0 XP</span>
              )}
            </span>
            <span className={`text-sm font-black font-mono ${
              pointsEarned > 0 ? 'text-[var(--c-primary)]'
              : pointsEarned < 0 ? 'text-[#ff3333]'
              : 'text-[var(--c-dark)]'
            }`}>
              {pointsEarned > 0 ? `+${pointsEarned}` : pointsEarned} PTS
            </span>
          </div>
          {streakMilestone && (
            <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-3 py-1.5 text-center">
              <span className="text-sm font-mono text-[var(--c-accent)]">
                ★ STREAK BONUS x{streak / 3} — +50 PTS INCLUDED ★
              </span>
            </div>
          )}
        </div>

        {/* Score bar */}
        <div className="term-border bg-[var(--c-bg)] px-3 py-2 flex items-center justify-between text-sm font-mono">
          <span className="text-[var(--c-muted)]">TOTAL SCORE</span>
          <span className="text-[var(--c-primary)] font-black text-sm">{totalScore} PTS</span>
          <span className="text-[var(--c-secondary)]">STREAK: <span className="text-[var(--c-primary)]">{streak}</span></span>
        </div>

        {/* Technique + difficulty banner */}
        {wasPhishing && card.technique && (
          <div className="term-border bg-[var(--c-bg)] border-[rgba(255,51,51,0.2)] px-3 py-2 flex items-center justify-between text-sm font-mono">
            <span className="text-[var(--c-dark)]">
              TECHNIQUE: <span className="text-[#ff3333]">{card.technique.toUpperCase().replace(/-/g, ' ')}</span>
            </span>
            <span className={{
              easy: 'text-[var(--c-secondary)]',
              medium: 'text-[#ffaa00]',
              hard: 'text-[#ff3333]',
              extreme: 'text-[#ff0080]',
            }[card.difficulty as string] ?? 'text-[var(--c-secondary)]'}>
              {card.difficulty.toUpperCase()}
            </span>
          </div>
        )}

        {/* Explanation — in left column on desktop */}
        <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] hidden lg:block">
          <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-accent)] text-sm tracking-widest">ANALYST_NOTES</span>
          </div>
          <p className="px-3 py-3 text-sm text-[var(--c-secondary)] leading-relaxed font-mono">{card.explanation}</p>
        </div>
        </div>{/* end left column */}

        {/* Right column: email review + signals */}
        <div className="flex flex-col gap-4 lg:flex-1 lg:min-w-0">
        {/* Interactive card review */}
        <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[var(--c-dark)] text-sm tracking-widest">
              {card.type === 'sms' ? 'INCOMING_SMS' : 'INCOMING_EMAIL'}
            </span>
            <span className="text-[var(--c-dark)] text-sm font-mono">■ □ □</span>
          </div>

          {/* Header rows */}
          {(() => {
            const { displayName, email } = parseFrom(card.from);
            const hl = (text: string) =>
              wasPhishing && card.highlights?.length
                ? highlightBody(text, card.highlights).map((seg, i) =>
                    seg.highlighted
                      ? <mark key={i} style={{ backgroundColor: '#ffaa00', color: 'var(--c-bg)', borderRadius: '2px', padding: '0 2px' }}>{seg.text}</mark>
                      : <span key={i}>{seg.text}</span>
                  )
                : text;
            return (
          <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] space-y-1">
            <div className="flex gap-2 text-sm font-mono">
              <span className="text-[var(--c-dark)] w-10 shrink-0">FROM:</span>
              <span className="text-[var(--c-secondary)] font-mono">
                {displayName ? (
                  <>
                    <span className="break-all">{hl(displayName)}</span>
                    <span className="block text-[#ffaa00] text-sm break-all mt-0.5">&lt;{hl(email)}&gt;</span>
                  </>
                ) : (
                  <span className="break-all">{hl(email)}</span>
                )}
              </span>
            </div>
            {card.subject && (
              <div className="flex gap-2 text-sm font-mono">
                <span className="text-[var(--c-dark)] w-10 shrink-0">SUBJ:</span>
                <span className="text-[var(--c-secondary)]">
                  {wasPhishing && card.highlights?.length
                    ? highlightBody(card.subject, card.highlights).map((seg, i) =>
                        seg.highlighted
                          ? <mark key={i} style={{ backgroundColor: '#ffaa00', color: 'var(--c-bg)', borderRadius: '2px', padding: '0 2px' }}>{seg.text}</mark>
                          : <span key={i}>{seg.text}</span>
                      )
                    : card.subject}
                </span>
              </div>
            )}
            {card.attachmentName && (
              <div className="flex gap-2 text-sm font-mono">
                <span className="text-[var(--c-dark)] w-10 shrink-0">ATCH:</span>
                <span className="text-[#ffaa00] font-mono">📎 {card.attachmentName}</span>
              </div>
            )}
          </div>
            );
          })()}

          {/* Body */}
          <pre className="px-3 py-3 text-xs text-[var(--c-muted)] font-mono leading-relaxed whitespace-pre-wrap break-words max-h-40 lg:max-h-52 momentum-scroll scroll-fade-bottom">
            {parseBodySegments(card.body).map((seg, i) =>
              seg.type === 'url' ? (
                <span
                  key={i}
                  className="text-[#ffaa00] underline cursor-pointer hover:text-[#ffcc44] transition-colors"
                  onClick={() => setInspectedUrl(seg.actual === inspectedUrl ? null : seg.actual)}
                >
                  {seg.display}<span className="opacity-50 text-sm ml-0.5">[↗]</span>
                </span>
              ) : (
                wasPhishing && card.highlights?.length
                  ? highlightBody(seg.content, card.highlights).map((hl, j) =>
                      hl.highlighted
                        ? <mark key={j} style={{ backgroundColor: '#ffaa00', color: 'var(--c-bg)', borderRadius: '2px', padding: '0 2px' }}>{hl.text}</mark>
                        : <span key={j}>{hl.text}</span>
                    )
                  : <span key={i}>{seg.content}</span>
              )
            )}
          </pre>

          {/* URL inspector */}
          {inspectedUrl && (
            <div className="border-t border-[rgba(255,170,0,0.3)] px-3 py-2 bg-[rgba(255,170,0,0.04)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#ffaa00] text-sm font-mono tracking-widest">URL_INSPECTOR</span>
                <button
                  onClick={() => setInspectedUrl(null)}
                  aria-label="Close URL inspector"
                  className="text-[var(--c-dark)] text-sm font-mono hover:text-[var(--c-secondary)] transition-colors"
                >
                  [ × ]
                </button>
              </div>
              <span className="text-[#ffaa00] font-mono text-sm break-all">{inspectedUrl}</span>
            </div>
          )}
          <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] px-3 py-1.5">
            <p className="text-[var(--c-muted)] text-[9px] font-mono opacity-50 text-center">AI-generated for research. Brand names used for realism only — no affiliation.</p>
          </div>
        </div>

        {/* Explanation — mobile only (desktop shows in left column) */}
        <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] lg:hidden">
          <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_25%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-accent)] text-sm tracking-widest">ANALYST_NOTES</span>
          </div>
          <p className="px-3 py-3 text-sm text-[var(--c-secondary)] leading-relaxed font-mono">{card.explanation}</p>
        </div>

        {/* Forensic signals */}
        {(() => {
          const signals: string[] = [];

          // URL presence — applies to both email and SMS
          if (/https?:\/\/\S+/.test(card.body)) {
            signals.push(`This ${card.type === 'sms' ? 'message' : 'email'} contained URLs. The URL inspector reveals the full destination before clicking.`);
          }

          if (signals.length === 0) return null;

          return (
            <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)]">
              <button
                onClick={() => setShowSignals((o) => !o)}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--c-accent)_4%,transparent)] transition-colors"
              >
                <span className="text-[var(--c-accent)] text-sm tracking-widest">FORENSIC_SIGNALS</span>
                <span className="text-[var(--c-accent)] text-sm">{showSignals ? '▲' : '▼'}</span>
              </button>
              {showSignals && (
              <ul className="border-t border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-3 py-3 space-y-2">
                {signals.map((signal, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[var(--c-secondary)] font-mono">
                    <span className="text-[var(--c-accent)] shrink-0">▸</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
              )}
            </div>
          );
        })()}

        {/* Red flags */}
        {wasPhishing && card.clues.length > 0 && (
          <div className="term-border bg-[var(--c-bg)] border-[rgba(255,51,51,0.3)]">
            <button
              onClick={() => setShowClues((o) => !o)}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[rgba(255,51,51,0.04)] transition-colors"
            >
              <span className="text-[#ff3333] text-sm tracking-widest">RED_FLAGS_DETECTED</span>
              <span className="text-[#ff3333] text-sm">{showClues ? '▲' : '▼'}</span>
            </button>
            {showClues && (
            <ul className="border-t border-[rgba(255,51,51,0.3)] px-3 py-3 space-y-2">
              {card.clues.map((clue, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--c-secondary)] font-mono">
                  <span className="text-[#ff3333] shrink-0">▸</span>
                  <span>{clue}</span>
                </li>
              ))}
            </ul>
            )}
          </div>
        )}

        </div>{/* end right column */}
        </div>{/* end two-column wrapper */}

        <button
          onClick={onNext}
          className="w-full py-4 term-border-bright text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] transition-all anim-pulse-glow"
        >
          {questionNumber === total ? '[ VIEW RESULTS ]' : '[ NEXT TRANSMISSION ]'}
        </button>

        {/* Flag */}
        {!flagDone ? (
          <div className="text-center">
            {!showFlag ? (
              <button
                onClick={() => setShowFlag(true)}
                className="text-[var(--c-dark)] hover:text-[var(--c-secondary)] font-mono text-sm transition-colors"
              >
                [ REPORT ISSUE ]
              </button>
            ) : (
              <div className="term-border bg-[var(--c-bg)] border-[rgba(255,51,51,0.2)] px-3 py-3 space-y-2 text-left">
                <div className="text-[#aa2222] text-sm font-mono tracking-widest">REPORT_ISSUE</div>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full bg-[var(--c-bg)] border border-[rgba(255,51,51,0.3)] text-[var(--c-secondary)] font-mono text-sm px-2 py-1.5 focus:outline-none"
                >
                  <option value="">-- SELECT REASON --</option>
                  <option value="wrong_answer">Wrong answer (misclassified)</option>
                  <option value="too_obvious">Too obvious / not challenging</option>
                  <option value="poor_quality">Poor quality content</option>
                  <option value="other">Other</option>
                </select>
                <input
                  value={flagComment}
                  onChange={(e) => setFlagComment(e.target.value)}
                  placeholder="Comment (optional)"
                  className="w-full bg-transparent border border-[rgba(255,51,51,0.2)] text-[var(--c-secondary)] font-mono text-sm px-2 py-1 focus:outline-none placeholder:text-[var(--c-dark)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await fetch('/api/flag', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cardId: card.id, sessionId, reason: flagReason || null, comment: flagComment || null }),
                      });
                      setFlagDone(true);
                    }}
                    disabled={!flagReason}
                    className="flex-1 py-1.5 border border-[rgba(255,51,51,0.4)] text-[#ff3333] font-mono text-sm hover:bg-[rgba(255,51,51,0.08)] disabled:opacity-30 transition-all"
                  >
                    SUBMIT
                  </button>
                  <button
                    onClick={() => setShowFlag(false)}
                    className="px-3 py-1.5 border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] text-[var(--c-dark)] font-mono text-sm hover:text-[var(--c-secondary)] transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[var(--c-dark)] font-mono text-sm">FLAG SUBMITTED</div>
        )}
      </div>
    </div>
  );
}
