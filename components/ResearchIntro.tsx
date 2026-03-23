'use client';

import Link from 'next/link';

interface Props {
  onBegin: () => void;
}

export function ResearchIntro({ onBegin }: Props) {
  return (
    <div className="w-full max-w-sm lg:max-w-3xl px-4">
      <div className="anim-fade-in-up flex flex-col gap-4">
        {/* Research intro header */}
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

        {/* Two-column on desktop: signals + data collection side by side */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] lg:flex-1">
            <div className="border-b border-[color-mix(in_srgb,var(--c-accent)_30%,transparent)] px-3 py-1.5">
              <span className="text-[var(--c-accent)] text-sm tracking-widest">WHAT TO CHECK</span>
            </div>
            <ul className="px-3 py-3 space-y-2">
              {[
                'Sender domain \u2014 tap [\u2197] next to the sender name to reveal the actual email address',
                'Attachment name \u2014 check [ATCH] for suspicious filenames',
                'URL destinations \u2014 tap any link to inspect the full URL',
              ].map((signal, i) => (
                <li key={i} className="flex gap-2 text-sm text-[var(--c-secondary)] font-mono">
                  <span className="text-[var(--c-accent)] shrink-0">\u25B8</span>
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="term-border bg-[var(--c-bg)] border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] lg:flex-1">
            <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_25%,transparent)] px-3 py-1.5">
              <span className="text-[var(--c-secondary)] text-sm font-mono tracking-widest">DATA_COLLECTION</span>
            </div>
            <div className="px-3 py-3 space-y-2">
              <p className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed">
                Sign-in required. No password \u2014 just a 6-digit code to your email.
              </p>
              <p className="text-[var(--c-muted)] text-sm font-mono leading-relaxed">
                <span className="text-[var(--c-secondary)]">Recorded:</span>{' '}
                answer, confidence, response time, URL inspection, session position, self-reported background.
              </p>
              <p className="text-[var(--c-muted)] text-sm font-mono leading-relaxed">
                <span className="text-[var(--c-secondary)]">Not recorded:</span>{' '}
                email, IP, location, or any identifying information.
              </p>
              <p className="text-[var(--c-muted)] text-sm font-mono leading-relaxed">
                30 research answers to contribute. After that, Expert Mode and Intel unlock.{' '}
                <Link href="/intel/player" className="text-[var(--c-secondary)] hover:underline">Preview</Link>.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[var(--c-muted)] text-xs font-mono leading-relaxed mb-1">
            For educational and research purposes only. All emails are fictional and AI-generated.
          </p>
          <p className="text-[var(--c-muted)] text-xs font-mono">
            <Link href="/privacy" className="hover:text-[var(--c-secondary)] transition-colors underline">Privacy</Link>
            {' · '}
            <Link href="/terms" className="hover:text-[var(--c-secondary)] transition-colors underline">Terms</Link>
          </p>
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
