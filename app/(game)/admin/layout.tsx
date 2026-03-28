'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, type ReactNode } from 'react';

const TABS = [
  { label: 'OVERVIEW', href: '/admin' },
  { label: 'PLAYERS', href: '/admin/players' },
  { label: 'RESEARCH', href: '/admin/research' },
  { label: 'CONTENT', href: '/admin/content' },
  { label: 'TOOLS', href: '/admin/tools' },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/player/admin-check')
      .then((r) => { if (r.ok) setIsAdmin(true); })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center">
        <div className="text-[var(--c-muted)] font-mono text-sm animate-pulse">AUTHENTICATING...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center">
        <div className="text-[#ff3333] font-mono text-sm">ACCESS DENIED</div>
      </div>
    );
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-[var(--c-bg)] p-4 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-4xl mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[var(--c-accent)] text-xs font-mono tracking-widest font-bold">ADMIN_DASHBOARD</span>
          <Link href="/play" className="text-[var(--c-dark)] text-xs font-mono hover:text-[var(--c-secondary)] transition-colors">← GAME</Link>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 font-mono text-xs tracking-widest whitespace-nowrap transition-all ${
                isActive(tab.href)
                  ? 'text-[var(--c-primary)] border border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)]'
                  : 'text-[var(--c-muted)] hover:text-[var(--c-secondary)] border border-transparent'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-4xl">
        {children}
      </div>
    </div>
  );
}
