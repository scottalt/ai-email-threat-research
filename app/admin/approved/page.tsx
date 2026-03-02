'use client';

import { useState, useEffect, useCallback } from 'react';

const DATASET_TARGET = 550;

const TECHNIQUES = [
  'urgency',
  'authority-impersonation',
  'credential-harvest',
  'hyper-personalization',
  'pretexting',
  'fluent-prose',
];

const DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'];

interface ApprovedCard {
  id: string;
  card_id: string;
  is_phishing: boolean;
  technique: string | null;
  difficulty: string;
  from_address: string;
  subject: string | null;
  body: string;
  explanation: string;
  highlights: string[] | null;
  clues: string[] | null;
  review_notes: string | null;
  ai_model: string | null;
  approved_at: string;
}

export default function ApprovedPage() {
  const [cards, setCards] = useState<ApprovedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'phishing' | 'legit'>('all');
  const [filterTechnique, setFilterTechnique] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');

  // Edit state
  const [editFrom, setEditFrom] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTechnique, setEditTechnique] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('');
  const [editIsPhishing, setEditIsPhishing] = useState(true);
  const [editExplanation, setEditExplanation] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/approved');
      const { cards: data } = await res.json();
      setCards(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  function openEdit(card: ApprovedCard) {
    setEditingId(card.id);
    setEditFrom(card.from_address);
    setEditSubject(card.subject ?? '');
    setEditBody(card.body);
    setEditTechnique(card.technique ?? '');
    setEditDifficulty(card.difficulty);
    setEditIsPhishing(card.is_phishing);
    setEditExplanation(card.explanation);
    setEditNotes(card.review_notes ?? '');
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch('/api/admin/approved', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        fields: {
          from_address: editFrom,
          subject: editSubject || null,
          body: editBody,
          technique: editTechnique || null,
          difficulty: editDifficulty,
          is_phishing: editIsPhishing,
          explanation: editExplanation,
          review_notes: editNotes || null,
          word_count: editBody.trim().split(/\s+/).length,
          char_count: editBody.length,
        },
      }),
    });
    setSaving(false);
    setEditingId(null);
    fetchCards();
  }

  async function deleteCard(id: string) {
    if (!confirm('Remove this card from the approved dataset?')) return;
    setDeleting(id);
    await fetch(`/api/admin/approved?id=${id}`, { method: 'DELETE' });
    setDeleting(null);
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  const filtered = cards.filter((c) => {
    if (filterType === 'phishing' && !c.is_phishing) return false;
    if (filterType === 'legit' && c.is_phishing) return false;
    if (filterTechnique && c.technique !== filterTechnique) return false;
    if (filterDifficulty && c.difficulty !== filterDifficulty) return false;
    return true;
  });

  const difficultyColor: Record<string, string> = {
    easy: 'text-[#00aa28]',
    medium: 'text-[#ffaa00]',
    hard: 'text-[#ff3333]',
    extreme: 'text-[#ff0080]',
  };

  if (loading) return (
    <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
      <span className="text-[#00aa28] font-mono text-xs">LOADING...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060c06] p-4">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#00aa28] tracking-widest">
            APPROVED_CARDS
            <span className="text-[#00ff41] font-black"> {cards.length}</span>
            <span className="text-[#003a0e]">/{DATASET_TARGET}</span>
          </span>
          <div className="flex items-center gap-4">
            <div className="w-32 h-1.5 bg-[#003a0e]">
              <div
                className="h-full bg-[#00ff41]"
                style={{ width: `${Math.min((cards.length / DATASET_TARGET) * 100, 100)}%`, boxShadow: '0 0 4px rgba(0,255,65,0.8)' }}
              />
            </div>
            <span className="text-[#003a0e]">{Math.round((cards.length / DATASET_TARGET) * 100)}%</span>
            <a href="/admin" className="text-[#003a0e] hover:text-[#00aa28] transition-colors">← BACK</a>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <div className="flex border border-[rgba(0,255,65,0.2)]">
            {(['all', 'phishing', 'legit'] as const).map((v) => (
              <button key={v} onClick={() => setFilterType(v)}
                className={`px-3 py-1.5 transition-all ${filterType === v ? 'bg-[rgba(0,255,65,0.12)] text-[#00ff41]' : 'text-[#003a0e] hover:text-[#00aa28]'}`}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>

          <select value={filterTechnique} onChange={(e) => setFilterTechnique(e.target.value)}
            className="bg-[#060c06] border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
            <option value="">ALL TECHNIQUES</option>
            {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}
            className="bg-[#060c06] border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
            <option value="">ALL DIFFICULTIES</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
          </select>

          <span className="text-[#003a0e] self-center">{filtered.length} shown</span>
        </div>

        {/* Card list */}
        {filtered.length === 0 ? (
          <div className="term-border bg-[#060c06] px-4 py-8 text-center text-[#003a0e] font-mono text-xs">
            NO CARDS MATCH FILTER
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((card) => (
              <div key={card.id} className="term-border bg-[#060c06]">
                {/* Row */}
                <div className="px-3 py-2 flex items-center gap-3 text-xs font-mono">
                  <span className={`shrink-0 font-black ${card.is_phishing ? 'text-[#ff3333]' : 'text-[#00ff41]'}`}>
                    {card.is_phishing ? 'PHISH' : 'LEGIT'}
                  </span>
                  <span className={`shrink-0 w-16 ${difficultyColor[card.difficulty] ?? 'text-[#00aa28]'}`}>
                    {card.difficulty.toUpperCase()}
                  </span>
                  <span className="shrink-0 w-36 text-[#00aa28] truncate">
                    {card.technique ?? '—'}
                  </span>
                  <span className="text-[#003a0e] truncate flex-1 min-w-0">
                    {card.from_address}
                  </span>
                  <span className="text-[#003a0e] truncate w-48 hidden md:block">
                    {card.subject ?? '—'}
                  </span>
                  <span className="text-[#002a0a] shrink-0 hidden lg:block">
                    {card.ai_model ?? ''}
                  </span>
                  <div className="flex gap-2 shrink-0 ml-auto">
                    <button
                      onClick={() => editingId === card.id ? setEditingId(null) : openEdit(card)}
                      className="px-2 py-0.5 border border-[rgba(0,255,65,0.3)] text-[#00aa28] hover:bg-[rgba(0,255,65,0.08)] transition-all"
                    >
                      {editingId === card.id ? 'CLOSE' : 'EDIT'}
                    </button>
                    <button
                      onClick={() => deleteCard(card.id)}
                      disabled={deleting === card.id}
                      className="px-2 py-0.5 border border-[rgba(255,51,51,0.3)] text-[#ff3333] hover:bg-[rgba(255,51,51,0.08)] disabled:opacity-30 transition-all"
                    >
                      DEL
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === card.id && (
                  <div className="border-t border-[rgba(0,255,65,0.2)] px-3 py-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editFrom} onChange={(e) => setEditFrom(e.target.value)}
                        placeholder="FROM"
                        className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]" />
                      <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)}
                        placeholder="SUBJECT (optional)"
                        className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]" />
                    </div>
                    <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
                      rows={8}
                      className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)] resize-none" />
                    <textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)}
                      rows={3} placeholder="Explanation"
                      className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none resize-none" />
                    <div className="flex gap-2">
                      <div className="flex gap-2">
                        {['phishing', 'legit'].map((v) => (
                          <button key={v} onClick={() => setEditIsPhishing(v === 'phishing')}
                            className={`px-2 py-1 text-xs font-mono border transition-all ${
                              (v === 'phishing') === editIsPhishing
                                ? v === 'phishing' ? 'text-[#ff3333] border-[rgba(255,51,51,0.6)]' : 'text-[#00ff41] border-[rgba(0,255,65,0.6)]'
                                : 'text-[#003a0e] border-[rgba(0,255,65,0.15)]'
                            }`}>
                            {v.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <select value={editTechnique} onChange={(e) => setEditTechnique(e.target.value)}
                        className="bg-[#060c06] border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none">
                        <option value="">— TECHNIQUE —</option>
                        {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select value={editDifficulty} onChange={(e) => setEditDifficulty(e.target.value)}
                        className="bg-[#060c06] border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none">
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                      </select>
                      <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Review notes"
                        className="flex-1 bg-transparent border border-[rgba(0,255,65,0.15)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none" />
                      <button onClick={() => saveEdit(card.id)} disabled={saving}
                        className="px-3 py-1 border border-[rgba(0,255,65,0.5)] text-[#00ff41] font-mono text-xs hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 transition-all">
                        {saving ? 'SAVING...' : 'SAVE'}
                      </button>
                    </div>
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
