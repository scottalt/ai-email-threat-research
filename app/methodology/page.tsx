import { readFileSync } from 'fs';
import { join } from 'path';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

export const metadata = {
  title: 'Research Methodology — Retro Phish',
  description: 'Full methodology for the State of Phishing in the GenAI Era research study.',
};

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-[#00ff41] text-sm font-black font-mono tracking-widest mt-6 mb-3 glow">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[#00aa28] text-sm font-bold font-mono tracking-widest mt-5 mb-2 border-b border-[rgba(0,255,65,0.2)] pb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[#00aa28] text-sm font-bold font-mono tracking-wide mt-4 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[#00aa28] text-sm font-mono leading-relaxed mb-3">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-[#00ff41] font-bold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-[#ffaa00] not-italic">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 space-y-1 pl-3">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 space-y-1 pl-3 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-[#00aa28] text-sm font-mono leading-relaxed flex gap-2">
      <span className="text-[#003a0e] shrink-0">▸</span>
      <span>{children}</span>
    </li>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code className="block bg-[#020c02] border border-[rgba(0,255,65,0.15)] px-3 py-2 text-[#00ff41] text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre mb-3">
          {children}
        </code>
      );
    }
    return <code className="text-[#00ff41] bg-[#020c02] px-1 font-mono text-sm">{children}</code>;
  },
  pre: ({ children }) => <div className="mb-3">{children}</div>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[rgba(0,255,65,0.3)] pl-3 my-3">{children}</blockquote>
  ),
  hr: () => <hr className="border-[rgba(0,255,65,0.15)] my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm font-mono border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-[rgba(0,255,65,0.1)]">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left text-[#003a0e] tracking-widest py-1 pr-4 font-normal text-sm">{children}</th>
  ),
  td: ({ children }) => (
    <td className="text-[#00aa28] py-1 pr-4 align-top">{children}</td>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-[#00aa28] underline hover:text-[#00ff41] transition-colors" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export default function MethodologyPage() {
  const content = readFileSync(join(process.cwd(), 'docs/research/methodology.md'), 'utf-8');

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4 mt-8 mb-12">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-sm tracking-widest">RESEARCH_METHODOLOGY</span>
            <Link href="/intel" className="text-[#003a0e] text-sm font-mono hover:text-[#00aa28] transition-colors">
              ← INTEL
            </Link>
          </div>
          <div className="px-4 py-4">
            <ReactMarkdown components={components}>{content}</ReactMarkdown>
          </div>
        </div>

        <div className="flex gap-3 text-sm font-mono">
          <Link href="/intel" className="text-[#003a0e] hover:text-[#00aa28] transition-colors">← INTEL</Link>
          <Link href="/" className="text-[#003a0e] hover:text-[#00aa28] transition-colors">← TERMINAL</Link>
        </div>
      </div>
    </div>
  );
}
