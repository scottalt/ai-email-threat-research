'use client';

import type { GimmickId, CardModifier } from '@/lib/roguelike';

interface SafeCard {
  _idx: number;
  type: string;
  from: string;
  subject?: string;
  body: string;
  authStatus?: string;
}

interface CardDisplayProps {
  card: SafeCard;
  cardIndex: number;
  cards: SafeCard[];
  gimmick: GimmickId | null;
  modifiers: CardModifier[];
  blackoutRedactSender: boolean;
  blackoutRedactSubject: boolean;
  inspectedFields: Set<string>;
  onInspect: (field: string) => void;
  intel: number;
  freeInspections: number;
  timerProgress: number | null;
  timerColor: string;
  /** Extra class applied to the card border container (e.g. anim-red-flash) */
  cardClassName?: string;
}

export function RoguelikeCardDisplay({
  card,
  cardIndex,
  cards,
  gimmick,
  modifiers,
  blackoutRedactSender,
  blackoutRedactSubject,
  inspectedFields,
  onInspect,
  intel,
  freeInspections,
  timerProgress,
  timerColor,
  cardClassName = '',
}: CardDisplayProps) {
  const isInvestigation = gimmick === 'INVESTIGATION';
  const hasDecoyRedFlags = modifiers.includes('DECOY_RED_FLAGS');
  const hasAiEnhanced = modifiers.includes('AI_ENHANCED');

  const hasRedactedSender = modifiers.includes('REDACTED_SENDER');
  const isBlackout = gimmick === 'BLACKOUT';
  const showSenderRedacted = hasRedactedSender || blackoutRedactSender || (isBlackout && hasRedactedSender);
  const showSubjectRedacted = blackoutRedactSubject || (isBlackout && hasRedactedSender);


  return (
    <>
      {/* TRIAGE: Inbox preview */}
      {gimmick === 'TRIAGE' && (
        <div className="term-border divide-y divide-[var(--c-dark)]">
          <div className="px-3 py-1.5 text-xs text-[var(--c-muted)] tracking-widest">
            INBOX — TRIAGE {cardIndex + 1}/{cards.length}
          </div>
          {cards.slice(0, Math.min(cards.length, cardIndex + 3)).map((c, i) => {
            const isCurrent = i === cardIndex;
            const isAnswered = i < cardIndex;
            return (
              <div
                key={i}
                className={`px-3 py-2 text-xs font-mono flex items-baseline gap-1 min-w-0 ${
                  isCurrent ? 'bg-[color-mix(in_srgb,var(--c-primary)_6%,transparent)]' : ''
                } ${isAnswered ? 'opacity-40 line-through' : ''}`}
              >
                <span className={`shrink-0 ${isCurrent ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}`}>
                  {c.from?.split('@')[0] ?? '???'}
                </span>
                {c.subject && (
                  <span className="text-[var(--c-secondary)] truncate min-w-0">
                    {c.subject}
                  </span>
                )}
                {isCurrent && <span className="text-[var(--c-primary)] shrink-0">◄</span>}
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

      <div className={`term-border p-4 space-y-3 ${cardClassName}`}>
        {/* Timer progress bar */}
        {timerProgress !== null && (
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--c-dark)' }}
          >
            <div
              className="h-full rounded-full roguelike-timer-bar-js"
              style={{
                width: `${timerProgress * 100}%`,
                background: timerColor,
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
              <span className="text-[var(--c-secondary)]">{card.from}</span>
            </div>
            {/* INVESTIGATION: inspect FROM button */}
            {isInvestigation && !inspectedFields.has('from') && (
              <button
                onClick={() => onInspect('from')}
                disabled={intel < 3}
                aria-label="Inspect sender field for 3 Intel"
                className={`text-[10px] tracking-wide px-1.5 py-0.5 term-border transition-all active:scale-95 ${
                  intel < 3 ? 'opacity-30 cursor-not-allowed' : ''
                }`}
                style={{ color: '#00d4ff' }}
              >
                INSPECT (-3)
              </button>
            )}
            {/* INVESTIGATION: inspected FROM result */}
            {isInvestigation && inspectedFields.has('from') && card.authStatus && (
              <span className="text-[10px] text-[var(--c-muted)]">
                [{card.authStatus}]
              </span>
            )}
          </div>
        )}

        {/* SUBJECT */}
        {card.subject && (
          showSubjectRedacted ? (
            <div className="text-sm">
              <span className="text-[var(--c-muted)]">SUBJ: </span>
              <span style={{ color: '#ff333366' }}>[REDACTED]</span>
            </div>
          ) : (
            <div className="text-sm flex items-center gap-2">
              <div>
                <span className="text-[var(--c-muted)]">SUBJ: </span>
                <span className="text-[var(--c-secondary)]">{card.subject}</span>
              </div>
              {/* INVESTIGATION: inspect SUBJECT button */}
              {isInvestigation && !inspectedFields.has('subject') && (
                <button
                  onClick={() => onInspect('subject')}
                  disabled={intel < 3}
                  aria-label="Inspect subject field for 3 Intel"
                  className={`text-[10px] tracking-wide px-1.5 py-0.5 term-border transition-all active:scale-95 ${
                    intel < 3 ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                  style={{ color: '#00d4ff' }}
                >
                  INSPECT (-3)
                </button>
              )}
              {/* INVESTIGATION: inspected SUBJECT result — shows auth status */}
              {isInvestigation && inspectedFields.has('subject') && card.authStatus && (
                <span className="text-[10px] text-[var(--c-muted)]">
                  [{card.authStatus}]
                </span>
              )}
            </div>
          )
        )}

        {/* BODY */}
        <div className="text-sm text-[var(--c-secondary)] leading-relaxed whitespace-pre-wrap max-h-52 lg:max-h-none overflow-y-auto">
          {card.body}
        </div>
      </div>
    </>
  );
}
