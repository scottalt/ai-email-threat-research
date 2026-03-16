import { readFileSync } from 'fs';
import { join } from 'path';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

export const metadata = {
  title: 'Research Methodology',
  description: 'Full methodology for the State of Phishing in the GenAI Era research study.',
};

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-[var(--c-primary)] text-sm font-black font-mono tracking-widest mt-6 mb-3">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[var(--c-secondary)] text-sm font-bold font-mono tracking-widest mt-5 mb-2 border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] pb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[var(--c-secondary)] text-sm font-bold font-mono tracking-wide mt-4 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed mb-3">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-[var(--c-primary)] font-bold">{children}</strong>
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
    <li className="text-[var(--c-secondary)] text-sm font-mono leading-relaxed flex gap-2">
      <span className="text-[var(--c-dark)] shrink-0">▸</span>
      <span>{children}</span>
    </li>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code className="block bg-[#020c02] border border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] px-3 py-2 text-[var(--c-primary)] text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre mb-3">
          {children}
        </code>
      );
    }
    return <code className="text-[var(--c-primary)] bg-[#020c02] px-1 font-mono text-sm">{children}</code>;
  },
  pre: ({ children }) => <div className="mb-3">{children}</div>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[color-mix(in_srgb,var(--c-primary)_30%,transparent)] pl-3 my-3">{children}</blockquote>
  ),
  hr: () => <hr className="border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm font-mono border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-[color-mix(in_srgb,var(--c-primary)_10%,transparent)]">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left text-[var(--c-dark)] tracking-widest py-1 pr-4 font-normal text-sm">{children}</th>
  ),
  td: ({ children }) => (
    <td className="text-[var(--c-secondary)] py-1 pr-4 align-top">{children}</td>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-[var(--c-secondary)] underline hover:text-[var(--c-primary)] transition-colors" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export default function MethodologyPage() {
  const content = readFileSync(join(process.cwd(), 'docs/research/methodology.md'), 'utf-8');

  return (
    <div className="min-h-screen bg-[var(--c-bg)] p-4 flex flex-col items-center lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-2xl space-y-4 mt-8 mb-12">
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">RESEARCH_METHODOLOGY</span>
          </div>
          <div className="px-4 py-4">
            <ReactMarkdown components={components}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
