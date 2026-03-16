import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[rgba(255,51,51,0.35)] px-3 py-1.5">
            <span className="text-[#ff3333] text-sm tracking-widest">ERROR_404</span>
          </div>
          <div className="px-3 py-6 text-center space-y-3">
            <div className="text-5xl font-black font-mono text-[#ff3333]">404</div>
            <div className="text-sm font-mono text-[var(--c-secondary)]">
              Route not found. This endpoint does not exist.
            </div>
            <div className="text-sm font-mono text-[var(--c-dark)]">
              Check the URL and try again.
            </div>
          </div>
        </div>
        <Link
          href="/"
          className="block w-full py-4 term-border text-center text-[var(--c-secondary)] font-mono font-bold tracking-widest text-sm hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] active:scale-95 transition-all"
        >
          [ BACK TO TERMINAL ]
        </Link>
      </div>
    </div>
  );
}
