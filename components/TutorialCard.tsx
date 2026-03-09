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
  bodyBefore: `We have detected unusual activity on your PayPal account. To avoid permanent suspension, you must verify your identity immediately.\n\nYour account access will be restricted in 24 hours if no action is taken.\n\nVerify your account now: `,
  url: 'http://paypa1-secure.com/verify?token=a9f3k2xR',
  bodyAfter: `\n\nDo not ignore this message. Failure to verify will result in permanent account closure.\n\n— PayPal Security Team`,
};

type Confidence = 'GUESSING' | 'LIKELY' | 'CERTAIN';

const CONFIDENCE_OPTIONS: { key: Confidence; mult: string; color: string; penalty: string }[] = [
  { key: 'GUESSING', mult: '1×', color: 'text-[#00aa28]', penalty: 'no penalty' },
  { key: 'LIKELY',   mult: '2×', color: 'text-[#ffaa00]', penalty: '−100 if wrong' },
  { key: 'CERTAIN',  mult: '3×', color: 'text-[#ff3333]', penalty: '−200 if wrong' },
];

export function TutorialCard({ onComplete }: Props) {
  const [showHeaders, setShowHeaders] = useState(true);
  const [showFrom, setShowFrom] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [headersInteracted, setHeadersInteracted] = useState(false);
  const [fromInteracted, setFromInteracted] = useState(false);
  const [urlInteracted, setUrlInteracted] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [answer, setAnswer] = useState<'PHISHING' | 'LEGIT' | null>(null);

  return (
    <div className="anim-fade-in-up w-full max-w-sm px-4 flex flex-col gap-4 pb-safe">

      {/* Annotation strip */}
      <div className="term-border border-[rgba(255,170,0,0.5)] bg-[#060c06] px-3 py-3 space-y-1">
        <div className="text-[#ffaa00] text-xs font-mono font-bold tracking-widest">TRAINING_SIMULATION</div>
        <div className="text-[#00aa28] text-[10px] font-mono leading-relaxed">
          Explore the forensic tools below, then set your confidence and classify this email.
        </div>
      </div>

      {/* Fake email card */}
      <div className="term-border bg-[#060c06]">
        {/* Card header with pulsing HEADERS button */}
        <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[#003a0e] text-[10px] font-mono tracking-widest">INCOMING_EMAIL</span>
          <button
            type="button"
            onClick={() => {
              setHeadersInteracted(true);
              setShowHeaders((v) => !v);
            }}
            className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
              showHeaders
                ? 'border-[rgba(0,255,65,0.6)] text-[#00ff41]'
                : 'border-[rgba(0,255,65,0.25)] text-[#003a0e] hover:text-[#00aa28]'
            } ${!headersInteracted ? 'anim-hint-pulse' : ''}`}
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
                  onClick={() => {
                    setFromInteracted(true);
                    setShowFrom((v) => !v);
                  }}
                  className={`transition-colors ${
                    fromInteracted
                      ? 'text-[#003a0e] hover:text-[#00aa28]'
                      : 'text-[#ffaa00] anim-hint-text-pulse'
                  }`}
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
            {TUTORIAL_EMAIL.bodyBefore}
            <button
              type="button"
              onClick={() => {
                setUrlInteracted(true);
                setShowUrl((v) => !v);
              }}
              className={`underline underline-offset-2 transition-colors ${
                urlInteracted
                  ? 'text-[#ffaa00] hover:text-[#ffcc44]'
                  : 'text-[#ffaa00] anim-hint-text-pulse'
              }`}
            >
              {TUTORIAL_EMAIL.url}
            </button>
            {TUTORIAL_EMAIL.bodyAfter}
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

      {/* Confidence selector */}
      {!answer && (
        <div className="term-border bg-[#060c06] px-3 py-3 space-y-2">
          <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">SET CONFIDENCE</div>
          <div className="flex gap-2">
            {CONFIDENCE_OPTIONS.map(({ key, mult, color, penalty }) => (
              <button
                key={key}
                type="button"
                onClick={() => setConfidence(key)}
                className={`flex-1 py-2 border text-[10px] font-mono font-bold transition-all ${
                  confidence === key
                    ? `${color} border-current bg-[rgba(0,255,65,0.04)]`
                    : 'text-[#003a0e] border-[rgba(0,255,65,0.2)] hover:text-[#00aa28]'
                }`}
              >
                <div>{key}</div>
                <div className="text-[8px] font-normal opacity-70 mt-0.5">{mult} · {penalty}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Answer buttons */}
      {confidence && !answer && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setAnswer('PHISHING')}
            className="flex-1 py-4 term-border border-[rgba(255,51,51,0.5)] text-[#ff3333] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,51,51,0.08)] active:scale-95 transition-all"
          >
            [ PHISHING ]
          </button>
          <button
            type="button"
            onClick={() => setAnswer('LEGIT')}
            className="flex-1 py-4 term-border text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:scale-95 transition-all"
          >
            [ LEGIT ]
          </button>
        </div>
      )}

      {/* Result panel */}
      {answer && (
        <div className={`term-border px-3 py-3 space-y-2 ${
          answer === 'PHISHING'
            ? 'border-[rgba(0,255,65,0.5)]'
            : 'border-[rgba(255,51,51,0.5)]'
        } bg-[#060c06]`}>
          <div className={`text-xs font-mono font-bold tracking-widest ${
            answer === 'PHISHING' ? 'text-[#00ff41]' : 'text-[#ff3333]'
          }`}>
            {answer === 'PHISHING' ? '✓ PHISHING — CORRECT' : '✗ LEGIT — INCORRECT'}
          </div>
          <div className="text-[#00aa28] text-[10px] font-mono space-y-0.5">
            <div>• <span className="text-[#ffaa00]">FROM:</span> paypa1.com — typosquatted domain</div>
            <div>• <span className="text-[#ffaa00]">HEADERS:</span> SPF / DKIM / DMARC all FAIL</div>
            <div>• <span className="text-[#ffaa00]">SENT:</span> 3:14 AM — unusual send time</div>
            <div>• <span className="text-[#ffaa00]">REPLY-TO:</span> free provider, domain mismatch</div>
            <div>• <span className="text-[#ffaa00]">URL:</span> paypa1-secure.com — typosquatted</div>
          </div>
        </div>
      )}

      {/* GOT IT — only shown after answering */}
      {answer && (
        <button
          type="button"
          onClick={onComplete}
          className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
        >
          [ GOT IT — START RESEARCH ]
        </button>
      )}

    </div>
  );
}
