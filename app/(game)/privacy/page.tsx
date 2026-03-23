import { readFileSync } from 'fs';
import { join } from 'path';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How Threat Terminal handles your data.',
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
    <em className="text-[var(--c-accent)] not-italic">{children}</em>
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
  a: ({ href, children }) => (
    <a href={href} className="text-[var(--c-secondary)] underline hover:text-[var(--c-primary)] transition-colors" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export default function PrivacyPage() {
  const content = readFileSync(join(process.cwd(), 'docs/research/privacy.md'), 'utf-8');

  return (
    <div className="min-h-screen bg-[var(--c-bg)] p-4 flex flex-col items-center lg:pt-16 pb-20 lg:pb-8">
      <div className="w-full max-w-2xl space-y-4 mt-8 mb-12">
        <div className="term-border bg-[var(--c-bg)]">
          <div className="border-b border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] px-3 py-2">
            <span className="text-[var(--c-secondary)] text-sm tracking-widest">PRIVACY_POLICY</span>
          </div>
          <div className="px-4 py-4">
            <ReactMarkdown components={components}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
