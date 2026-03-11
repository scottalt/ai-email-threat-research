import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(255,51,51,0.35)] px-3 py-1.5">
            <span className="text-[#ff3333] text-sm tracking-widest">ERROR_404</span>
          </div>
          <div className="px-3 py-6 text-center space-y-3">
            <div className="text-5xl font-black font-mono text-[#ff3333]">404</div>
            <div className="text-sm font-mono text-[#00aa28]">
              Route not found. This endpoint does not exist.
            </div>
            <div className="text-sm font-mono text-[#003a0e]">
              Check the URL and try again.
            </div>
          </div>
        </div>
        <Link
          href="/"
          className="block w-full py-4 term-border text-center text-[#00aa28] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.05)] active:scale-95 transition-all"
        >
          [ BACK TO TERMINAL ]
        </Link>
      </div>
    </div>
  );
}
