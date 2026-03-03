import { readFileSync } from 'fs';
import { join } from 'path';
import Link from 'next/link';

export const metadata = {
  title: 'Research Methodology — Retro Phish',
  description: 'Full methodology for the State of Phishing in the GenAI Era research study.',
};

export default function MethodologyPage() {
  const content = readFileSync(join(process.cwd(), 'docs/research/methodology.md'), 'utf-8');

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4 mt-8 mb-12">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">RESEARCH_METHODOLOGY</span>
            <Link href="/intel" className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28] transition-colors">
              ← INTEL
            </Link>
          </div>
          <pre className="px-4 py-4 text-xs text-[#00aa28] font-mono leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">
            {content}
          </pre>
        </div>

        <div className="flex gap-3 text-xs font-mono">
          <Link href="/intel" className="text-[#003a0e] hover:text-[#00aa28] transition-colors">← INTEL</Link>
          <Link href="/" className="text-[#003a0e] hover:text-[#00aa28] transition-colors">← TERMINAL</Link>
        </div>
      </div>
    </div>
  );
}
