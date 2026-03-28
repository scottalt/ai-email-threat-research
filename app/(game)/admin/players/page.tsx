'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface PlayerRow {
  id: string;
  display_name: string | null;
  xp: number;
  level: number;
  total_sessions: number;
  research_graduated: boolean;
  background: string | null;
  created_at: string;
}

export default function AdminPlayers() {
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const LIMIT = 25;

  function fetchPlayers(q: string, s: string, o: string, off: number) {
    setLoading(true);
    const params = new URLSearchParams({ q, sort: s, order: o, limit: String(LIMIT), offset: String(off) });
    fetch(`/api/admin/players?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) { setPlayers(data.players); setTotal(data.total); }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchPlayers(query, sort, order, offset);
  }, [sort, order, offset]);

  function handleSearch(val: string) {
    setQuery(val);
    setOffset(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPlayers(val, sort, order, 0), 300);
  }

  function toggleSort(col: string) {
    if (sort === col) setOrder(order === 'desc' ? 'asc' : 'desc');
    else { setSort(col); setOrder('desc'); }
    setOffset(0);
  }

  const pageNum = Math.floor(offset / LIMIT) + 1;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="term-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[var(--c-accent)] text-xs font-mono tracking-widest shrink-0">SEARCH</span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="callsign, player ID, or auth ID..."
            className="flex-1 bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] px-3 py-2 text-[var(--c-primary)] font-mono text-sm placeholder:text-[var(--c-dark)] focus:outline-none focus:border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)]"
          />
        </div>
        <div className="text-[var(--c-muted)] text-xs font-mono mt-2">
          {loading ? 'Searching...' : `${total} player${total !== 1 ? 's' : ''} found`}
        </div>
      </div>

      {/* Results table */}
      <div className="term-border overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]">
              {[
                { col: 'display_name', label: 'CALLSIGN' },
                { col: 'level', label: 'LVL' },
                { col: 'xp', label: 'XP' },
                { col: 'total_sessions', label: 'SESSIONS' },
                { col: 'created_at', label: 'JOINED' },
              ].map(({ col, label }) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-[var(--c-secondary)] text-xs tracking-widest cursor-pointer hover:text-[var(--c-primary)] transition-colors"
                  onClick={() => toggleSort(col)}
                >
                  {label} {sort === col ? (order === 'desc' ? '▾' : '▴') : ''}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-[var(--c-secondary)] text-xs tracking-widest">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-[color-mix(in_srgb,var(--c-primary)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-primary)_3%,transparent)] transition-colors">
                <td className="px-3 py-2">
                  <Link href={`/admin/players/${p.id}`} className="text-[var(--c-primary)] hover:underline">
                    {p.display_name ?? <span className="text-[var(--c-dark)] italic">no callsign</span>}
                  </Link>
                </td>
                <td className="px-3 py-2 text-[var(--c-secondary)]">{p.level}</td>
                <td className="px-3 py-2 text-[var(--c-accent)]">{p.xp.toLocaleString()}</td>
                <td className="px-3 py-2 text-[var(--c-secondary)]">{p.total_sessions}</td>
                <td className="px-3 py-2 text-[var(--c-muted)]">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  {p.research_graduated
                    ? <span className="text-[var(--c-primary)] text-xs">GRADUATED</span>
                    : <span className="text-[var(--c-dark)] text-xs">IN RESEARCH</span>
                  }
                </td>
              </tr>
            ))}
            {!loading && players.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--c-muted)]">
                  {query ? 'No players match your search' : 'No players found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs font-mono">
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
            className="text-[var(--c-secondary)] hover:text-[var(--c-primary)] disabled:text-[var(--c-dark)] disabled:cursor-default transition-colors"
          >
            ← PREV
          </button>
          <span className="text-[var(--c-muted)]">PAGE {pageNum} / {totalPages}</span>
          <button
            onClick={() => setOffset(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="text-[var(--c-secondary)] hover:text-[var(--c-primary)] disabled:text-[var(--c-dark)] disabled:cursor-default transition-colors"
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}
