'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FlaggedCard {
  card_id: string;
  count: number;
  reasons: Record<string, number>;
  comments: string[];
  latest: string;
  subject?: string | null;
  from_address?: string;
  is_phishing?: boolean;
}

interface FlagData {
  totalFlags: number;
  flaggedCards: number;
  cards: FlaggedCard[];
}

const REASON_LABELS: Record<string, string> = {
  wrong_answer: 'WRONG ANSWER',
  too_obvious: 'TOO OBVIOUS',
  poor_quality: 'POOR QUALITY',
  other: 'OTHER',
};

export default function FlagsPage() {
  const [data, setData] = useState<FlagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState('');
  const [minFlags, setMinFlags] = useState(1);

  useEffect(() => {
    fetch('/api/admin/flags')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
      <span className="text-[#00aa28] font-mono text-xs">LOADING...</span>
    </div>
  );

  if (!data || data.totalFlags === 0) return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl mt-8 space-y-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#ff3333] tracking-widest">PLAYER_FLAGS</span>
          <Link href="/admin" className="text-[#003a0e] hover:text-[#00aa28]">← BACK</Link>
        </div>
        <div className="term-border bg-[#060c06] px-4 py-8 text-center text-[#003a0e] font-mono text-xs">
          NO FLAGS REPORTED YET
        </div>
      </div>
    </div>
  );

  const filtered = data.cards.filter(c => {
    if (c.count < minFlags) return false;
    if (filterReason && !(c.reasons[filterReason] > 0)) return false;
    return true;
  });

  // Aggregate reason totals
  const reasonTotals: Record<string, number> = {};
  for (const c of data.cards) {
    for (const [r, n] of Object.entries(c.reasons)) {
      reasonTotals[r] = (reasonTotals[r] ?? 0) + n;
    }
  }

  return (
    <div className="min-h-screen bg-[#060c06] p-4">
      <div className="max-w-2xl mx-auto space-y-4 mt-8">

        {/* Header */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#ff3333] tracking-widest">
            PLAYER_FLAGS
            <span className="text-[#ffaa00] font-black ml-2">{data.totalFlags}</span>
            <span className="text-[#003a0e] ml-1">across {data.flaggedCards} cards</span>
          </span>
          <Link href="/admin" className="text-[#003a0e] hover:text-[#00aa28] transition-colors">← BACK</Link>
        </div>

        {/* Reason breakdown */}
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(REASON_LABELS).map(([key, label]) => (
            <div key={key} className="term-border border-[rgba(255,51,51,0.2)] px-2 py-2 text-center">
              <div className="text-lg font-black font-mono text-[#ff3333]">{reasonTotals[key] ?? 0}</div>
              <div className="text-[9px] font-mono text-[#003a0e] mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 text-xs font-mono">
          <select
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
            className="bg-[#060c06] border border-[rgba(255,51,51,0.2)] text-[#ff3333] font-mono text-xs px-2 py-1.5 focus:outline-none"
          >
            <option value="">ALL REASONS</option>
            {Object.entries(REASON_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={minFlags}
            onChange={(e) => setMinFlags(Number(e.target.value))}
            className="bg-[#060c06] border border-[rgba(255,51,51,0.2)] text-[#ff3333] font-mono text-xs px-2 py-1.5 focus:outline-none"
          >
            {[1, 2, 3, 5, 10].map(n => (
              <option key={n} value={n}>{n}+ FLAGS</option>
            ))}
          </select>
          <span className="text-[#003a0e] self-center ml-auto">{filtered.length} cards shown</span>
        </div>

        {/* Card list */}
        {filtered.length === 0 ? (
          <div className="term-border bg-[#060c06] px-4 py-8 text-center text-[#003a0e] font-mono text-xs">
            NO CARDS MATCH FILTER
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((card) => (
              <div key={card.card_id} className="term-border bg-[#060c06]">
                <button
                  onClick={() => setExpandedCard(expandedCard === card.card_id ? null : card.card_id)}
                  className="w-full px-3 py-2 flex items-center gap-3 text-xs font-mono text-left hover:bg-[rgba(255,51,51,0.03)] transition-all"
                >
                  <span className="text-[#ff3333] font-black w-8 text-right shrink-0">{card.count}x</span>
                  <span className={`shrink-0 font-black ${card.is_phishing ? 'text-[#ff3333]' : 'text-[#00ff41]'}`}>
                    {card.is_phishing !== undefined ? (card.is_phishing ? 'PHISH' : 'LEGIT') : '??'}
                  </span>
                  <span className="text-[#003a0e] truncate flex-1 min-w-0">
                    {card.subject ?? card.from_address ?? card.card_id}
                  </span>
                  <span className="text-[#003a0e] text-[10px] shrink-0">
                    {Object.entries(card.reasons).map(([r, n]) => `${REASON_LABELS[r] ?? r}(${n})`).join(' ')}
                  </span>
                </button>

                {expandedCard === card.card_id && (
                  <div className="border-t border-[rgba(255,51,51,0.15)] px-3 py-3 space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                      <div>
                        <span className="text-[#003a0e]">CARD ID: </span>
                        <span className="text-[#00aa28]">{card.card_id}</span>
                      </div>
                      <div>
                        <span className="text-[#003a0e]">FROM: </span>
                        <span className="text-[#00aa28]">{card.from_address ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#003a0e]">SUBJECT: </span>
                        <span className="text-[#00aa28]">{card.subject ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#003a0e]">LATEST FLAG: </span>
                        <span className="text-[#ffaa00]">{new Date(card.latest).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Reason breakdown */}
                    <div className="space-y-1">
                      <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">REASONS</div>
                      {Object.entries(card.reasons).map(([reason, count]) => (
                        <div key={reason} className="flex items-center gap-2 text-xs font-mono">
                          <div className="w-24 h-1.5 bg-[#003a0e]">
                            <div
                              className="h-full bg-[#ff3333]"
                              style={{ width: `${(count / card.count) * 100}%` }}
                            />
                          </div>
                          <span className="text-[#ff3333] font-black w-6 text-right">{count}</span>
                          <span className="text-[#00aa28]">{REASON_LABELS[reason] ?? reason}</span>
                        </div>
                      ))}
                    </div>

                    {/* Comments */}
                    {card.comments.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">COMMENTS ({card.comments.length})</div>
                        {card.comments.map((comment, i) => (
                          <div key={i} className="text-xs font-mono text-[#00aa28] bg-[rgba(0,255,65,0.03)] px-2 py-1 border-l-2 border-[rgba(255,51,51,0.3)]">
                            {comment}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
