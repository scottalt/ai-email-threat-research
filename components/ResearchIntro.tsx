'use client';

import Link from 'next/link';

interface Props {
  onBegin: () => void;
}

export function ResearchIntro({ onBegin }: Props) {
  return (
    <div className="w-full max-w-sm px-4">
      <div className="anim-fade-in-up flex flex-col gap-4">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2">
            <span className="text-[#00aa28] text-xs tracking-widest">RESEARCH_MODE</span>
          </div>
          <div className="px-3 py-4 space-y-3">
            <div className="text-[#00ff41] text-sm font-black font-mono tracking-wide glow">
              STATE OF PHISHING IN THE GENAI ERA
            </div>
            <p className="text-[#00aa28] text-xs font-mono leading-relaxed">
              You are participating in an anonymous research study measuring which phishing techniques humans most likely miss when linguistic quality is no longer a reliable signal.
            </p>
            <p className="text-[#00aa28] text-xs font-mono leading-relaxed">
              All emails in this deck are AI-generated. Grammar and spelling will be perfect. Your job is to find the forensic signals.
            </p>
          </div>
        </div>

        <div className="term-border bg-[#060c06] border-[rgba(255,170,0,0.3)]">
          <div className="border-b border-[rgba(255,170,0,0.3)] px-3 py-1.5">
            <span className="text-[#ffaa00] text-xs tracking-widest">WHAT TO CHECK</span>
          </div>
          <ul className="px-3 py-3 space-y-2">
            {[
              'Sender domain — tap [↗] next to the sender name to reveal the actual email address, then compare the domain to any domain referenced in the body',
              'Send time — check [SENT] for odd hours or mismatched timezones',
              'Attachment name — check [ATCH] for suspicious filenames or unexpected file types',
              'Authentication headers — tap [HEADERS] for SPF/DKIM/DMARC result',
              'Reply-To mismatch — visible in [HEADERS] panel',
              'URL destinations — tap any link to inspect the full URL',
            ].map((signal, i) => (
              <li key={i} className="flex gap-2 text-xs text-[#00aa28] font-mono">
                <span className="text-[#ffaa00] shrink-0">▸</span>
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="term-border bg-[#060c06] border-[rgba(0,255,65,0.15)]">
          <div className="border-b border-[rgba(0,255,65,0.15)] px-3 py-1.5">
            <span className="text-[#003a0e] text-[10px] font-mono tracking-widest">DATA_COLLECTION</span>
          </div>
          <div className="px-3 py-3 space-y-2">
            <p className="text-[#003a0e] text-[10px] font-mono leading-relaxed">
              No account required. No personally identifiable information is collected.
            </p>
            <p className="text-[#003a0e] text-[10px] font-mono leading-relaxed">
              <span className="text-[#00aa28]">Recorded:</span>{' '}
              your answer, confidence level, response time, whether you opened headers or clicked URLs, and position within the session. A random session ID is generated each round and kept in memory only — never stored on your device or linked to you.
            </p>
            <p className="text-[#003a0e] text-[10px] font-mono leading-relaxed">
              <span className="text-[#00aa28]">Not recorded:</span>{' '}
              email address, IP address, location, or any identifying information.
            </p>
            <p className="text-[#003a0e] text-[10px] font-mono leading-relaxed">
              Participation is voluntary. Play{' '}
              <span className="text-[#00aa28]">[ PLAY ]</span>{' '}
              instead to opt out. Aggregate findings published at{' '}
              <Link href="/intel" className="text-[#00aa28] hover:underline">/intel</Link>.
            </p>
          </div>
        </div>

        <button
          onClick={() => { localStorage.setItem('research_intro_seen', '1'); onBegin(); }}
          className="w-full py-4 term-border-bright text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] active:bg-[rgba(0,255,65,0.15)] transition-all glow"
        >
          [ BEGIN RESEARCH ]
        </button>
      </div>
    </div>
  );
}
