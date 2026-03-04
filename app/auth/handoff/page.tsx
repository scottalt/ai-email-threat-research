import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ c?: string }>;
}

export default async function HandoffPage({ searchParams }: Props) {
  const { c } = await searchParams;
  if (!c) redirect('/');

  return (
    <main className="min-h-screen bg-[#060c06] flex items-center justify-center px-4">
      <div className="w-full max-w-xs font-mono space-y-6">
        <div className="border border-[rgba(0,255,65,0.35)] bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2">
            <span className="text-[#00aa28] text-xs tracking-widest">AUTH_HANDOFF</span>
          </div>
          <div className="px-3 py-6 space-y-4 text-center">
            <div className="text-[#00aa28] text-xs">You&apos;re signed in.</div>
            <div className="text-[#003a0e] text-[10px] leading-relaxed">
              Open the Retro Phish app and enter this code:
            </div>
            <div className="text-[#00ff41] text-3xl tracking-[0.4em] font-bold glow py-2">
              {c}
            </div>
            <div className="text-[#003a0e] text-[10px]">Valid for 5 minutes · single use</div>
          </div>
        </div>
      </div>
    </main>
  );
}
