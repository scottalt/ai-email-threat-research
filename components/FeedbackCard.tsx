'use client';

import { useEffect, useState } from 'react';
import type { RoundResult } from '@/lib/types';
import { highlightBody } from '@/lib/highlightBody';

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

export function FeedbackCard({ result, streak, totalScore, onNext, questionNumber, total, sessionId }: Props) {
  const { card, correct, userAnswer, confidence, pointsEarned } = result;
  const wasPhishing = card.isPhishing;
  const streakMilestone = streak > 0 && streak % 3 === 0;

  const [showFlash, setShowFlash] = useState(true);
  const [showFlag, setShowFlag] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagComment, setFlagComment] = useState('');
  const [flagDone, setFlagDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowFlash(false), 600);
    return () => clearTimeout(t);
  }, []);

  const headline = correct
    ? wasPhishing ? 'THREAT NEUTRALIZED' : 'ASSET CLEARED'
    : wasPhishing ? 'BREACH DETECTED' : 'FALSE POSITIVE';

  const headlineColor = correct ? 'text-[#00ff41]' : 'text-[#ff3333]';
  const headlineGlow = correct ? 'glow' : 'glow-red';

  return (
    <div className="w-full max-w-sm px-4 relative">
      {showFlash && (
        <div
          className={`fixed inset-0 pointer-events-none z-50 ${
            correct ? 'bg-[rgba(0,255,65,0.07)] clear-overlay' : 'bg-[rgba(255,0,0,0.12)] breach-overlay'
          }`}
        />
      )}

      <div className="anim-fade-in-up flex flex-col gap-4">
        {/* Result header */}
        <div className={`term-border bg-[#060c06] ${correct ? 'border-[rgba(0,255,65,0.6)]' : 'border-[rgba(255,51,51,0.6)]'}`}>
          <div className={`border-b px-3 py-2 flex items-center justify-between ${correct ? 'border-[rgba(0,255,65,0.4)]' : 'border-[rgba(255,51,51,0.4)]'}`}>
            <span className={`text-xs font-mono tracking-widest ${correct ? 'text-[#00aa28]' : 'text-[#aa2222]'}`}>
              ANALYSIS_RESULT
            </span>
            <span className="text-xs font-mono text-[#003a0e]">Q{questionNumber}/{total}</span>
          </div>
          <div className="px-3 py-4 text-center space-y-1">
            <div className={`text-2xl font-black font-mono tracking-widest ${headlineColor} ${headlineGlow}`}>
              {headline}
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
            <span className={`text-sm font-black font-mono ${correct ? 'text-[#00ff41] glow' : 'text-[#003a0e]'}`}>
              +{pointsEarned} PTS
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

        {/* Sender recap */}
        <div className="term-border bg-[#060c06] px-3 py-2 space-y-1">
          <div className="flex gap-2 text-xs font-mono">
            <span className="text-[#003a0e] w-10 shrink-0">FROM:</span>
            <span className="text-[#00aa28] break-all">
              {wasPhishing && card.highlights?.length
                ? highlightBody(card.from, card.highlights).map((seg, i) =>
                    seg.highlighted ? (
                      <mark key={i} style={{ backgroundColor: '#ffaa00', color: '#060c06', borderRadius: '2px', padding: '0 2px' }}>{seg.text}</mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )
                : card.from}
            </span>
          </div>
          {card.subject && (
            <div className="flex gap-2 text-xs font-mono">
              <span className="text-[#003a0e] w-10 shrink-0">SUBJ:</span>
              <span className="text-[#00aa28]">
                {wasPhishing && card.highlights?.length
                  ? highlightBody(card.subject, card.highlights).map((seg, i) =>
                      seg.highlighted ? (
                        <mark key={i} style={{ backgroundColor: '#ffaa00', color: '#060c06', borderRadius: '2px', padding: '0 2px' }}>{seg.text}</mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                    )
                  : card.subject}
              </span>
            </div>
          )}
        </div>

        {/* Message body with highlights */}
        {wasPhishing && card.highlights && card.highlights.length > 0 && (
          <div className="term-border bg-[#060c06] border-[rgba(255,51,51,0.3)]">
            <div className="border-b border-[rgba(255,51,51,0.3)] px-3 py-1.5">
              <span className="text-[#aa2222] text-xs tracking-widest">MESSAGE_BODY</span>
            </div>
            <pre className="px-3 py-3 text-xs text-[#00aa28] font-mono leading-relaxed whitespace-pre-wrap break-words">
              {highlightBody(card.body, card.highlights).map((seg, i) =>
                seg.highlighted ? (
                  <mark
                    key={i}
                    style={{
                      backgroundColor: '#ffaa00',
                      color: '#060c06',
                      borderRadius: '2px',
                      padding: '0 2px',
                    }}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </pre>
          </div>
        )}

        {/* Explanation */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
            <span className="text-[#00aa28] text-xs tracking-widest">ANALYST_NOTES</span>
          </div>
          <p className="px-3 py-3 text-xs text-[#00aa28] leading-relaxed font-mono">{card.explanation}</p>
        </div>

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
          className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
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
