'use client';

import Link from 'next/link';

interface Props {
  onBegin: () => void;
}

export function ResearchIntro({ onBegin }: Props) {
  return (
    <div className="w-full max-w-sm px-4">
      <div className="anim-fade-in-up flex flex-col gap-4">
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">RESEARCH_MODE</span>
          </div>
          <div className="px-3 py-4 space-y-3">
            <div className="text-[var(--c-primary)] text-sm font-black font-mono tracking-wide">
              STATE OF PHISHING IN THE GENAI ERA
            </div>
            <p className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed">
              You are participating in an anonymous research study measuring which phishing techniques humans most likely miss when linguistic quality is no longer a reliable signal.
            </p>
            <p className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed">
              All emails in this deck are AI-generated. Grammar and spelling will be perfect. Your job is to find the forensic signals.
            </p>
          </div>
        </div>

        <div className="term-border bg-[var(--c-bg)] border-[rgba(255,170,0,0.3)]">
          <div className="border-b border-[rgba(255,170,0,0.3)] px-3 py-1.5">
            <span className="text-[#ffaa00] text-sm tracking-widest">WHAT TO CHECK</span>
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
              <li key={i} className="flex gap-2 text-sm text-[var(--c-secondary)] font-mono">
                <span className="text-[#ffaa00] shrink-0">▸</span>
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-3 py-1.5">
            <span className="text-[var(--c-dark)] text-sm font-mono tracking-widest">DATA_COLLECTION</span>
          </div>
          <div className="px-3 py-3 space-y-2">
            <p className="text-[var(--c-dark)] text-sm font-mono leading-relaxed">
              A sign-in is required to contribute answers to the study. No password — just a 6-digit code to your email.
            </p>
            <p className="text-[var(--c-dark)] text-sm font-mono leading-relaxed">
              <span className="text-[var(--c-secondary)]">Recorded:</span>{' '}
              your answer, confidence level, response time, whether you opened headers or clicked URLs, position within the session, and your self-reported background (expertise level).
            </p>
            <p className="text-[var(--c-dark)] text-sm font-mono leading-relaxed">
              <span className="text-[var(--c-secondary)]">Not recorded:</span>{' '}
              email address, IP address, location, or any identifying information. Your email is used only for sign-in and is never associated with your answers.
            </p>
            <p className="text-[var(--c-dark)] text-sm font-mono leading-relaxed">
              Each player contributes 30 research answers. After that, Expert Mode and the Intel Briefing unlock.{' '}
              <Link href="/intel/player" className="text-[var(--c-secondary)] hover:underline">Preview</Link>.
            </p>
          </div>
        </div>

        <button
          onClick={() => { localStorage.setItem('research_intro_seen', '1'); onBegin(); }}
          className="w-full py-4 term-border text-[var(--c-primary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] active:bg-[color-mix(in_srgb,var(--c-primary)_10%,transparent)] transition-all"
        >
          [ BEGIN RESEARCH ]
        </button>
      </div>
    </div>
  );
}
