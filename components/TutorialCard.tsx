'use client';

import { useState } from 'react';

interface Props {
  onComplete: () => void;
}

const TUTORIAL_EMAIL = {
  from: 'security-alerts@paypa1.com',
  fromDisplay: 'PayPal Security',
  subject: 'Urgent: Your account has been limited',
  sentAt: 'Mar 9, 2026, 3:14 AM',
  attachmentName: 'account_recovery.zip',
  replyTo: 'support@gmail-helpdesk.com',
  body: `We have detected unusual activity on your PayPal account. To avoid permanent suspension, you must verify your identity immediately.

Your account access will be restricted in 24 hours if no action is taken.

Verify your account now: http://paypa1-secure.com/verify?token=a9f3k2xR

Do not ignore this message. Failure to verify will result in permanent account closure.

— PayPal Security Team`,
  url: 'http://paypa1-secure.com/verify?token=a9f3k2xR',
};

export function TutorialCard({ onComplete }: Props) {
  const [showHeaders, setShowHeaders] = useState(true); // pre-expanded
  const [showFrom, setShowFrom] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  return (
    <div className="anim-fade-in-up w-full max-w-sm px-4 flex flex-col gap-4 pb-safe">

      {/* Annotation strip */}
      <div className="term-border border-[rgba(255,170,0,0.5)] bg-[#060c06] px-3 py-3 space-y-1">
        <div className="text-[#ffaa00] text-xs font-mono font-bold tracking-widest">TRAINING_SIMULATION</div>
        <div className="text-[#00aa28] text-[10px] font-mono leading-relaxed">
          This card demonstrates the forensic signals used in Research Mode.
          Tap <span className="text-[#ffaa00]">[HEADERS]</span>, URLs, and{' '}
          <span className="text-[#ffaa00]">[↗]</span> on the sender to explore each tool.
        </div>
      </div>

      {/* Confidence block */}
      <div className="term-border bg-[#060c06] px-3 py-3 space-y-2">
        <div className="text-[#00aa28] text-[10px] font-mono tracking-widest">CONFIDENCE BETTING</div>
        <div className="text-[#00aa28] text-[10px] font-mono leading-relaxed">
          Before answering each card, set your confidence level:
        </div>
        <div className="space-y-1">
          {[
            { label: 'GUESSING', mult: '1×', note: 'no penalty if wrong', color: 'text-[#00aa28]' },
            { label: 'LIKELY',   mult: '2×', note: 'lose 100 pts if wrong', color: 'text-[#ffaa00]' },
            { label: 'CERTAIN',  mult: '3×', note: 'lose 200 pts if wrong', color: 'text-[#ff3333]' },
          ].map(({ label, mult, note, color }) => (
            <div key={label} className="flex items-center gap-2 text-[10px] font-mono">
              <span className={`w-16 font-bold ${color}`}>{label}</span>
              <span className="text-[#00ff41]">{mult}</span>
              <span className="text-[#00aa28]">— {note}</span>
            </div>
          ))}
        </div>
        <div className="text-[#00aa28] text-[10px] font-mono pt-1">
          Don&apos;t bet CERTAIN unless you&apos;re sure.
        </div>
      </div>

      {/* Fake email card */}
      <div className="term-border bg-[#060c06]">
        {/* Card header */}
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[#003a0e] text-[10px] font-mono tracking-widest">INCOMING_EMAIL</span>
          <button
            type="button"
            onClick={() => setShowHeaders((v) => !v)}
            className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
              showHeaders
                ? 'border-[rgba(0,255,65,0.6)] text-[#00ff41]'
                : 'border-[rgba(0,255,65,0.25)] text-[#003a0e] hover:text-[#00aa28]'
            }`}
          >
            [HEADERS]
          </button>
        </div>

        {/* Auth headers panel */}
        {showHeaders && (
          <div className="border-b border-[rgba(0,255,65,0.2)] px-3 py-2 bg-[#03080a] space-y-1">
            <div className="text-[#003a0e] text-[10px] font-mono tracking-widest mb-1">AUTH_HEADERS</div>
            {[
              { label: 'SPF', status: 'FAIL' },
              { label: 'DKIM', status: 'FAIL' },
              { label: 'DMARC', status: 'FAIL' },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-[#00aa28] w-12">{label}</span>
                <span className="text-[#ff3333] font-bold">{status}</span>
              </div>
            ))}
            <div className="pt-1 space-y-0.5">
              <div className="flex gap-2 text-[10px] font-mono">
                <span className="text-[#00aa28] w-16 shrink-0">REPLY-TO</span>
                <span className="text-[#ffaa00]">{TUTORIAL_EMAIL.replyTo}</span>
              </div>
            </div>
          </div>
        )}

        {/* Email metadata */}
        <div className="px-3 py-2 space-y-1 border-b border-[rgba(0,255,65,0.15)]">
          {/* FROM */}
          <div className="flex items-start gap-2 text-[10px] font-mono">
            <span className="text-[#003a0e] w-8 shrink-0 pt-0.5">FROM</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[#00ff41]">{TUTORIAL_EMAIL.fromDisplay}</span>
                <button
                  type="button"
                  onClick={() => setShowFrom((v) => !v)}
                  className="text-[#003a0e] hover:text-[#00aa28] transition-colors"
                  aria-label="Reveal sender email"
                >
                  {showFrom ? '[−]' : '[↗]'}
                </button>
              </div>
              {showFrom && (
                <div className="text-[#ffaa00] mt-0.5 break-all">{TUTORIAL_EMAIL.from}</div>
              )}
            </div>
          </div>
          {/* SUBJ */}
          <div className="flex items-start gap-2 text-[10px] font-mono">
            <span className="text-[#003a0e] w-8 shrink-0 pt-0.5">SUBJ</span>
            <span className="text-[#00ff41] flex-1">{TUTORIAL_EMAIL.subject}</span>
          </div>
          {/* SENT */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-[#003a0e] w-8 shrink-0">SENT</span>
            <span className="text-[#00aa28]">{TUTORIAL_EMAIL.sentAt}</span>
          </div>
          {/* ATCH */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-[#003a0e] w-8 shrink-0">ATCH</span>
            <span className="text-[#ffaa00]">📎 {TUTORIAL_EMAIL.attachmentName}</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2 max-h-40 overflow-y-auto">
          <div className="text-[#00aa28] text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {TUTORIAL_EMAIL.body.replace(TUTORIAL_EMAIL.url, '')}
            <button
              type="button"
              onClick={() => setShowUrl((v) => !v)}
              className="text-[#ffaa00] underline underline-offset-2 hover:text-[#ffcc44] transition-colors"
            >
              {TUTORIAL_EMAIL.url}
            </button>
          </div>
        </div>

        {/* URL inspector */}
        {showUrl && (
          <div className="border-t border-[rgba(255,170,0,0.3)] px-3 py-2 bg-[#03080a]">
            <div className="text-[#003a0e] text-[10px] font-mono tracking-widest mb-1">URL_INSPECTOR</div>
            <div className="text-[#ffaa00] text-[10px] font-mono break-all">{TUTORIAL_EMAIL.url}</div>
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onComplete}
        className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
      >
        [ GOT IT — START RESEARCH ]
      </button>

    </div>
  );
}
