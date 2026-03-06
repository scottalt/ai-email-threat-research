'use client';

import { useEffect, useState } from 'react';
import type { RoundResult } from '@/lib/types';
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

export function FeedbackCard({ result, streak, totalScore, onNext, questionNumber, total, sessionId }: Props) {
  const { card, correct, userAnswer, confidence, pointsEarned } = result;
  const wasPhishing = card.isPhishing;
  const streakMilestone = streak > 0 && streak % 3 === 0;

  const [showFlash, setShowFlash] = useState(true);
  const [showFlag, setShowFlag] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagComment, setFlagComment] = useState('');
  const [flagDone, setFlagDone] = useState(false);
  const [displayedHeadline, setDisplayedHeadline] = useState('');
  const [headlineDone, setHeadlineDone] = useState(false);
  const [headersOpen, setHeadersOpen] = useState(false);
  const [inspectedUrl, setInspectedUrl] = useState<string | null>(null);

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

  const headlineColor = correct ? 'text-[#00ff41]' : 'text-[#ff3333]';
  const headlineGlow = correct ? 'glow' : 'glow-red';

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
    return {
      spf: 'NONE', dkim: 'NONE', dmarc: 'NONE',
      replyTo: card.replyTo ?? card.from, returnPath: `<${card.from}>`,
      color: { spf: '#ffaa00', dkim: '#ffaa00', dmarc: '#ffaa00' },
    };
  })();

  return (
    <div className="w-full max-w-sm px-4 pb-safe relative">
      {showFlash && (
        <div
          className={`fixed inset-0 pointer-events-none z-50 ${
            correct ? 'bg-[rgba(0,255,65,0.07)] clear-overlay' : 'bg-[rgba(255,0,0,0.12)] breach-overlay'
          }`}
        />
      )}

      <div className="anim-fade-in-up flex flex-col gap-4">
        {/* Result header */}
        <div className={`term-border bg-[#060c06] ${correct ? 'border-[rgba(0,255,65,0.6)]' : 'border-[rgba(255,51,51,0.6)]'} ${!correct ? 'anim-glitch' : ''}`}>
          <div className={`border-b px-3 py-2 flex items-center justify-between ${correct ? 'border-[rgba(0,255,65,0.4)]' : 'border-[rgba(255,51,51,0.4)]'}`}>
            <span className={`text-xs font-mono tracking-widest ${correct ? 'text-[#00aa28]' : 'text-[#aa2222]'}`}>
              ANALYSIS_RESULT
            </span>
            <span className="text-xs font-mono text-[#003a0e]">Q{questionNumber}/{total}</span>
          </div>
          <div className="px-3 py-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-3">
              <div className={`text-2xl font-black font-mono tracking-widest ${headlineColor} ${headlineGlow}`}>
                {displayedHeadline}{!headlineDone && <span className="cursor" />}
              </div>
              {headlineDone && (
                <span className={`text-sm font-mono ${correct ? 'text-[#00aa28]' : 'text-[#aa2222]'}`}>
                  {correct ? (streak >= 6 ? '[^_^]' : streak >= 3 ? '[o_o]' : '[._.]') : '[x_x]'}
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-[#00aa28]">
              {wasPhishing
                ? `This was a PHISHING attempt. You said: ${userAnswer.toUpperCase()}.`
                : `This was LEGIT. You said: ${userAnswer.toUpperCase()}.`}
            </div>
          </div>
          <div className={`border-t px-3 py-2 flex items-center justify-between ${correct ? 'border-[rgba(0,255,65,0.25)]' : 'border-[rgba(255,51,51,0.25)]'}`}>
            <span className="text-xs font-mono text-[#00aa28]">
              CONFIDENCE: <span className="text-[#00ff41]">{CONFIDENCE_LABEL[confidence]}</span>
              {' '}({CONFIDENCE_MULTI[confidence]})
            </span>
            <span className={`text-sm font-black font-mono ${
              pointsEarned > 0 ? 'text-[#00ff41] glow'
              : pointsEarned < 0 ? 'text-[#ff3333]'
              : 'text-[#003a0e]'
            }`}>
              {pointsEarned > 0 ? `+${pointsEarned}` : pointsEarned} PTS
            </span>
          </div>
          {streakMilestone && (
            <div className="border-t border-[rgba(0,255,65,0.25)] px-3 py-1.5 text-center">
              <span className="text-xs font-mono text-[#ffaa00] glow-amber">
                ★ STREAK BONUS x{streak / 3} — +50 PTS INCLUDED ★
              </span>
            </div>
          )}
        </div>

        {/* Score bar */}
        <div className="term-border bg-[#060c06] px-3 py-2 flex items-center justify-between text-xs font-mono">
          <span className="text-[#00aa28]">TOTAL SCORE</span>
          <span className="text-[#00ff41] font-black text-sm glow">{totalScore} PTS</span>
          <span className="text-[#00aa28]">STREAK: <span className="text-[#00ff41]">{streak}</span></span>
        </div>

        {/* Technique + difficulty banner */}
        {wasPhishing && card.technique && (
          <div className="term-border bg-[#060c06] border-[rgba(255,51,51,0.2)] px-3 py-2 flex items-center justify-between text-xs font-mono">
            <span className="text-[#003a0e]">
              TECHNIQUE: <span className="text-[#ff3333]">{card.technique.toUpperCase().replace(/-/g, ' ')}</span>
            </span>
            <span className={{
              easy: 'text-[#00aa28]',
              medium: 'text-[#ffaa00]',
              hard: 'text-[#ff3333]',
              extreme: 'text-[#ff0080]',
            }[card.difficulty as string] ?? 'text-[#00aa28]'}>
              {card.difficulty.toUpperCase()}
            </span>
          </div>
        )}

        {/* Interactive card review */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">
              {card.type === 'sms' ? 'INCOMING_SMS' : 'INCOMING_EMAIL'}
            </span>
            {card.type === 'email' ? (
              <button
                onClick={() => setHeadersOpen((o) => !o)}
                className="text-[#00aa28] text-xs font-mono hover:text-[#00ff41] transition-colors"
              >
                [HEADERS]
              </button>
            ) : (
              <span className="text-[#003a0e] text-xs font-mono">■ □ □</span>
            )}
          </div>

          {/* Header rows */}
          {(() => {
            const { displayName, email } = parseFrom(card.from);
            const hl = (text: string) =>
              wasPhishing && card.highlights?.length
                ? highlightBody(text, card.highlights).map((seg, i) =>
                    seg.highlighted
                      ? <mark key={i} style={{ backgroundColor: '#ffaa00', color: '#060c06', borderRadius: '2px', padding: '0 2px' }}>{seg.text}</mark>
                      : <span key={i}>{seg.text}</span>
                  )
                : text;
            return (
          <div className="px-3 py-2 border-b border-[rgba(0,255,65,0.2)] space-y-1">
            <div className="flex gap-2 text-xs font-mono">
              <span className="text-[#003a0e] w-10 shrink-0">FROM:</span>
              <span className="text-[#00aa28] font-mono">
                {displayName ? (
                  <>
                    <span className="break-all">{hl(displayName)}</span>
                    <span className="block text-[#ffaa00] text-[10px] break-all mt-0.5">&lt;{hl(email)}&gt;</span>
                  </>
                ) : (
                  <span className="break-all">{hl(email)}</span>
                )}
              </span>
            </div>
            {card.subject && (
              <div className="flex gap-2 text-xs font-mono">
                <span className="text-[#003a0e] w-10 shrink-0">SUBJ:</span>
                <span className="text-[#00aa28]">
                  {wasPhishing && card.highlights?.length
                    ? highlightBody(card.subject, card.highlights).map((seg, i) =>
                        seg.highlighted
                          ? <mark key={i} style={{ backgroundColor: '#ffaa00', color: '#060c06', borderRadius: '2px', padding: '0 2px' }}>{seg.text}</mark>
                          : <span key={i}>{seg.text}</span>
                      )
                    : card.subject}
                </span>
              </div>
            )}
            {card.sentAt && (
              <div className="flex gap-2 text-xs font-mono">
                <span className="text-[#003a0e] w-10 shrink-0">SENT:</span>
                <span className="text-[#00aa28] text-[10px]">{card.sentAt}</span>
              </div>
            )}
            {card.attachmentName && (
              <div className="flex gap-2 text-xs font-mono">
                <span className="text-[#003a0e] w-10 shrink-0">ATCH:</span>
                <span className="text-[#ffaa00] font-mono">📎 {card.attachmentName}</span>
              </div>
            )}
          </div>
            );
          })()}

          {/* Expandable headers panel */}
          {headersOpen && card.type === 'email' && (
            <div className="border-b border-[rgba(0,255,65,0.2)] px-3 py-2 bg-[rgba(0,255,65,0.02)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#ffaa00] text-xs font-mono tracking-widest">HEADERS</span>
                <button
                  onClick={() => setHeadersOpen(false)}
                  className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28] transition-colors"
                >
                  [ × ]
                </button>
              </div>
              <div className="space-y-1 text-xs font-mono">
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

          {/* Body */}
          <pre className="px-3 py-3 text-xs text-[#00aa28] font-mono leading-relaxed whitespace-pre-wrap break-words max-h-52 momentum-scroll scroll-fade-bottom">
            {parseBodySegments(card.body).map((seg, i) =>
              seg.type === 'url' ? (
                <span
                  key={i}
                  className="text-[#ffaa00] underline cursor-pointer hover:text-[#ffcc44] transition-colors"
                  onClick={() => setInspectedUrl(seg.actual === inspectedUrl ? null : seg.actual)}
                >
                  {seg.display}<span className="opacity-50 text-[9px] ml-0.5">[↗]</span>
                </span>
              ) : (
                wasPhishing && card.highlights?.length
                  ? highlightBody(seg.content, card.highlights).map((hl, j) =>
                      hl.highlighted
                        ? <mark key={j} style={{ backgroundColor: '#ffaa00', color: '#060c06', borderRadius: '2px', padding: '0 2px' }}>{hl.text}</mark>
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
                <span className="text-[#ffaa00] text-xs font-mono tracking-widest">URL_INSPECTOR</span>
                <button
                  onClick={() => setInspectedUrl(null)}
                  className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28] transition-colors"
                >
                  [ × ]
                </button>
              </div>
              <span className="text-[#ffaa00] font-mono text-xs break-all">{inspectedUrl}</span>
            </div>
          )}
        </div>

        {/* Explanation */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-xs tracking-widest">ANALYST_NOTES</span>
          </div>
          <p className="px-3 py-3 text-xs text-[#00aa28] leading-relaxed font-mono">{card.explanation}</p>
        </div>

        {/* Forensic signals */}
        {(() => {
          const signals: string[] = [];

          // Auth status — email only (SPF/DKIM/DMARC don't apply to SMS)
          if (card.type === 'email') {
            if (card.authStatus === 'fail') {
              signals.push(wasPhishing
                ? 'SPF/DKIM/DMARC: FAIL — sender could not authenticate with the claimed domain. Strong indicator of spoofing.'
                : 'SPF/DKIM/DMARC: FAIL — sender\'s authentication failed. Some legitimate senders have misconfigured email infrastructure. Failure alone is not proof of phishing, but it warrants closer inspection.'
              );
            } else if (card.authStatus === 'unverified') {
              signals.push(wasPhishing
                ? 'SPF/DKIM/DMARC: NONE — authentication headers absent, consistent with domain spoofing.'
                : 'SPF/DKIM/DMARC: NONE — small senders often lack email authentication. Absence of auth headers alone is not a reliable phishing indicator.'
              );
            } else if (card.authStatus === 'verified') {
              signals.push(wasPhishing
                ? 'SPF/DKIM/DMARC: PASS — attacker registered a lookalike domain with valid authentication. Headers are clean; the domain name itself is the tell.'
                : 'SPF/DKIM/DMARC: PASS — sender domain authenticated correctly.'
              );
            }

            // Reply-To mismatch — email only
            if (card.replyTo) {
              signals.push(
                wasPhishing
                  ? `Reply-To: ${card.replyTo} — replies would route to the attacker's address, not the sender's domain.`
                  : `Reply-To: ${card.replyTo} — sender uses a separate reply address. Common in marketing and bulk mail.`
              );
            }
          }

          // URL presence — applies to both email and SMS
          if (/https?:\/\/\S+/.test(card.body)) {
            signals.push(`This ${card.type === 'sms' ? 'message' : 'email'} contained URLs. The URL inspector reveals the full destination before clicking.`);
          }

          // Send time — email only
          if (card.type === 'email' && card.sentAt) {
            signals.push(wasPhishing
              ? `Sent: ${card.sentAt} — verify the send time and timezone match the sender's claimed location.`
              : `Sent: ${card.sentAt} — send time is consistent with the sender's context.`
            );
          }

          if (signals.length === 0) return null;

          return (
            <div className="term-border bg-[#060c06] border-[rgba(255,170,0,0.3)]">
              <div className="border-b border-[rgba(255,170,0,0.3)] px-3 py-1.5">
                <span className="text-[#ffaa00] text-xs tracking-widest">FORENSIC_SIGNALS</span>
              </div>
              <ul className="px-3 py-3 space-y-2">
                {signals.map((signal, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[#00aa28] font-mono">
                    <span className="text-[#ffaa00] shrink-0">▸</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* Red flags */}
        {wasPhishing && card.clues.length > 0 && (
          <div className="term-border bg-[#060c06] border-[rgba(255,51,51,0.3)]">
            <div className="border-b border-[rgba(255,51,51,0.3)] px-3 py-1.5">
              <span className="text-[#aa2222] text-xs tracking-widest">RED_FLAGS_DETECTED</span>
            </div>
            <ul className="px-3 py-3 space-y-2">
              {card.clues.map((clue, i) => (
                <li key={i} className="flex gap-2 text-xs text-[#00aa28] font-mono">
                  <span className="text-[#ff3333] shrink-0">▸</span>
                  <span>{clue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onNext}
          className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow anim-pulse-glow"
        >
          {questionNumber === total ? '[ VIEW RESULTS ]' : '[ NEXT TRANSMISSION ]'}
        </button>

        {/* Flag */}
        {!flagDone ? (
          <div className="text-center">
            {!showFlag ? (
              <button
                onClick={() => setShowFlag(true)}
                className="text-[#003a0e] hover:text-[#00aa28] font-mono text-xs transition-colors"
              >
                [ REPORT ISSUE ]
              </button>
            ) : (
              <div className="term-border bg-[#060c06] border-[rgba(255,51,51,0.2)] px-3 py-3 space-y-2 text-left">
                <div className="text-[#aa2222] text-xs font-mono tracking-widest">REPORT_ISSUE</div>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full bg-[#060c06] border border-[rgba(255,51,51,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none"
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
                  className="w-full bg-transparent border border-[rgba(255,51,51,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none placeholder:text-[#003a0e]"
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
                    className="flex-1 py-1.5 border border-[rgba(255,51,51,0.4)] text-[#ff3333] font-mono text-xs hover:bg-[rgba(255,51,51,0.08)] disabled:opacity-30 transition-all"
                  >
                    SUBMIT
                  </button>
                  <button
                    onClick={() => setShowFlag(false)}
                    className="px-3 py-1.5 border border-[rgba(0,255,65,0.2)] text-[#003a0e] font-mono text-xs hover:text-[#00aa28] transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[#003a0e] font-mono text-xs">FLAG SUBMITTED</div>
        )}
      </div>
    </div>
  );
}
