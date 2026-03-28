'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ACHIEVEMENTS, RARITY_COLORS, type AchievementRarity } from '@/lib/achievements';

interface PlayerData {
  player: Record<string, unknown>;
  stats: { totalAnswers: number; correctAnswers: number; accuracy: number; researchAnswers: number; currentStreak: number; longestStreak: number; friendCount: number };
  achievements: { id: string; unlockedAt: string }[];
  h2h: { rankPoints: number; rankLabel: string; rankColor: string; wins: number; losses: number; winStreak: number; bestWinStreak: number; peakRankPoints: number } | null;
}

interface AnswerRow {
  id: string; card_id: string; session_id: string; game_mode: string; user_answer: string;
  correct: boolean; confidence: string; technique: string | null; difficulty: string | null;
  time_from_render_ms: number | null; created_at: string;
}

interface SessionRow {
  session_id: string; game_mode: string; is_daily_challenge: boolean;
  started_at: string; completed_at: string | null; cards_answered: number;
  final_score: number | null; final_rank: string | null;
}

export default function AdminPlayerDetail() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlayerData | null>(null);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [answerTotal, setAnswerTotal] = useState(0);
  const [answerOffset, setAnswerOffset] = useState(0);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'answers' | 'sessions' | 'achievements' | 'comms'>('overview');

  // Edit state
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [grantId, setGrantId] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  function fetchPlayer() {
    fetch(`/api/admin/players/${id}`)
      .then(async (r) => {
        if (!r.ok) { setError(`API ${r.status}: ${await r.text().catch(() => 'unknown')}`); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  function fetchAnswers(off: number) {
    fetch(`/api/admin/players/${id}/answers?limit=50&offset=${off}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setAnswers(d.answers); setAnswerTotal(d.total); } });
  }

  function fetchSessions(off: number) {
    fetch(`/api/admin/players/${id}/sessions?limit=50&offset=${off}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setSessions(d.sessions); setSessionTotal(d.total); } });
  }

  useEffect(() => { fetchPlayer(); fetchAnswers(0); fetchSessions(0); }, [id]);
  useEffect(() => { fetchAnswers(answerOffset); }, [answerOffset]);
  useEffect(() => { fetchSessions(sessionOffset); }, [sessionOffset]);

  async function saveField(field: string, value: unknown) {
    setSaving(true);
    setActionMsg(null);
    const body: Record<string, unknown> = { [field]: value };
    if (field === 'xp') body.reset = true; // recalculate level
    const res = await fetch(`/api/admin/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) { setActionMsg('SAVED'); fetchPlayer(); }
    else setActionMsg('FAILED');
    setSaving(false);
    setEditField(null);
  }

  async function grantAchievement() {
    if (!grantId) return;
    setActionMsg(null);
    const res = await fetch(`/api/admin/players/${id}/achievements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementId: grantId }),
    });
    if (res.ok) { setActionMsg(`Granted ${grantId}`); fetchPlayer(); setGrantId(''); }
    else setActionMsg('Grant failed');
  }

  async function revokeAchievement(achievementId: string) {
    setActionMsg(null);
    const res = await fetch(`/api/admin/players/${id}/achievements`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementId }),
    });
    if (res.ok) { setActionMsg(`Revoked ${achievementId}`); fetchPlayer(); }
    else setActionMsg('Revoke failed');
  }

  if (loading) return <div className="text-[var(--c-muted)] font-mono text-sm animate-pulse text-center py-8">LOADING PLAYER...</div>;
  if (error) return <div className="text-[#ff3333] font-mono text-sm text-center py-8 space-y-2"><div>ERROR</div><div className="text-xs text-[var(--c-muted)] break-all px-4">{error}</div><Link href="/admin/players" className="text-[var(--c-secondary)] text-xs hover:underline block mt-4">← BACK</Link></div>;
  if (!data) return <div className="text-[#ff3333] font-mono text-sm text-center py-8">PLAYER NOT FOUND<Link href="/admin/players" className="text-[var(--c-secondary)] text-xs hover:underline block mt-4">← BACK</Link></div>;

  const p = data.player;
  const earnedIds = new Set(data.achievements.map((a) => a.id));
  const unearnedAchievements = ACHIEVEMENTS.filter((a) => !earnedIds.has(a.id));

  // SIGINT message state
  const [msgLines, setMsgLines] = useState('');
  const [msgButton, setMsgButton] = useState('ACKNOWLEDGED');
  const [sendingMsg, setSendingMsg] = useState(false);

  function renderEditableField(label: string, field: string, currentValue: unknown, type: 'number' | 'text' | 'boolean' = 'text') {
    const isEditing = editField === field;
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-[var(--c-secondary)] text-xs tracking-widest">{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-2">
            {type === 'boolean' ? (
              <button
                onClick={() => saveField(field, !(currentValue as boolean))}
                disabled={saving}
                className="text-[var(--c-accent)] text-sm font-mono hover:text-[var(--c-primary)]"
              >
                {saving ? '...' : `→ ${!(currentValue as boolean) ? 'TRUE' : 'FALSE'}`}
              </button>
            ) : (
              <>
                <input
                  type={type}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_30%,transparent)] px-2 py-1 text-[var(--c-primary)] font-mono text-sm w-24 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveField(field, type === 'number' ? parseInt(editValue, 10) : editValue);
                    if (e.key === 'Escape') setEditField(null);
                  }}
                />
                <button onClick={() => saveField(field, type === 'number' ? parseInt(editValue, 10) : editValue)} disabled={saving} className="text-[var(--c-primary)] text-xs">✓</button>
              </>
            )}
            <button onClick={() => setEditField(null)} className="text-[var(--c-dark)] text-xs">✕</button>
          </div>
        ) : (
          <button
            onClick={() => { setEditField(field); setEditValue(String(currentValue ?? '')); }}
            className="text-[var(--c-primary)] font-mono text-sm hover:underline"
          >
            {type === 'boolean' ? ((currentValue as boolean) ? 'TRUE' : 'FALSE') : String(currentValue ?? '—')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back + action msg */}
      <div className="flex items-center justify-between">
        <Link href="/admin/players" className="text-[var(--c-muted)] text-xs font-mono hover:text-[var(--c-secondary)]">← ALL PLAYERS</Link>
        {actionMsg && <span className={`text-xs font-mono ${actionMsg.includes('fail') || actionMsg === 'FAILED' ? 'text-[#ff3333]' : 'text-[var(--c-primary)]'}`}>{actionMsg}</span>}
      </div>

      {/* Player header */}
      <div className="term-border px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[var(--c-primary)] text-lg font-mono font-black">{p.display_name as string ?? 'NO CALLSIGN'}</div>
            <div className="text-[var(--c-dark)] text-[10px] font-mono mt-0.5">{id}</div>
          </div>
          <div className="text-right">
            <div className="text-[var(--c-accent)] text-2xl font-black font-mono">LVL {p.level as number}</div>
            <div className="text-[var(--c-muted)] text-xs font-mono">{(p.xp as number).toLocaleString()} XP</div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="border-t border-[color-mix(in_srgb,var(--c-primary)_15%,transparent)] pt-3 space-y-1">
          {renderEditableField('XP', 'xp', p.xp, 'number')}
          {renderEditableField('LEVEL', 'level', p.level, 'number')}
          {renderEditableField('CALLSIGN', 'displayName', p.display_name, 'text')}
          {renderEditableField('BIO', 'bio', p.bio, 'text')}
          {renderEditableField('GRADUATED', 'researchGraduated', p.research_graduated, 'boolean')}
          {renderEditableField('SESSIONS', 'totalSessions', p.total_sessions, 'number')}
          {renderEditableField('CUSTOM TITLE', 'customTitle', p.custom_title, 'text')}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1">
        {(['overview', 'answers', 'sessions', 'achievements', 'comms'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 font-mono text-xs tracking-widest transition-all ${
              tab === t
                ? 'text-[var(--c-primary)] border border-[color-mix(in_srgb,var(--c-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)]'
                : 'text-[var(--c-muted)] hover:text-[var(--c-secondary)] border border-transparent'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'ANSWERS', value: data.stats.totalAnswers, color: 'text-[var(--c-primary)]' },
            { label: 'ACCURACY', value: `${data.stats.accuracy}%`, color: data.stats.accuracy >= 70 ? 'text-[var(--c-primary)]' : 'text-[var(--c-accent)]' },
            { label: 'RESEARCH', value: data.stats.researchAnswers, color: 'text-[var(--c-secondary)]' },
            { label: 'STREAK', value: `${data.stats.currentStreak}d`, color: 'text-[var(--c-secondary)]' },
            { label: 'FRIENDS', value: data.stats.friendCount, color: 'text-[var(--c-secondary)]' },
            { label: 'BADGES', value: data.achievements.length, color: 'text-[var(--c-accent)]' },
            ...(data.h2h ? [
              { label: 'H2H RANK', value: data.h2h.rankLabel, color: `text-[${data.h2h.rankColor}]` },
              { label: 'H2H W/L', value: `${data.h2h.wins}/${data.h2h.losses}`, color: 'text-[var(--c-secondary)]' },
            ] : []),
          ].map(({ label, value, color }) => (
            <div key={label} className="term-border px-3 py-3 text-center">
              <div className={`text-xl font-black font-mono ${color}`}>{value}</div>
              <div className="text-[9px] font-mono text-[var(--c-dark)] mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Answers tab */}
      {tab === 'answers' && (
        <div className="space-y-3">
          <div className="term-border overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]">
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">MODE</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">ANSWER</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">RESULT</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">CONF</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">TECHNIQUE</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">TIME</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">DATE</th>
                </tr>
              </thead>
              <tbody>
                {answers.map((a) => (
                  <tr key={a.id} className={`border-b border-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] ${a.correct ? '' : 'bg-[rgba(255,51,51,0.03)]'}`}>
                    <td className="px-2 py-1.5 text-[var(--c-muted)]">{a.game_mode}</td>
                    <td className="px-2 py-1.5 text-[var(--c-secondary)]">{a.user_answer}</td>
                    <td className={`px-2 py-1.5 ${a.correct ? 'text-[var(--c-primary)]' : 'text-[#ff3333]'}`}>{a.correct ? '✓' : '✗'}</td>
                    <td className="px-2 py-1.5 text-[var(--c-muted)]">{a.confidence?.[0]?.toUpperCase()}</td>
                    <td className="px-2 py-1.5 text-[var(--c-muted)]">{a.technique ?? '—'}</td>
                    <td className="px-2 py-1.5 text-[var(--c-muted)]">{a.time_from_render_ms ? `${(a.time_from_render_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td className="px-2 py-1.5 text-[var(--c-dark)]">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {answerTotal > 50 && (
            <div className="flex items-center justify-between text-xs font-mono">
              <button onClick={() => setAnswerOffset(Math.max(0, answerOffset - 50))} disabled={answerOffset === 0} className="text-[var(--c-secondary)] disabled:text-[var(--c-dark)]">← PREV</button>
              <span className="text-[var(--c-muted)]">{answerOffset + 1}–{Math.min(answerOffset + 50, answerTotal)} of {answerTotal}</span>
              <button onClick={() => setAnswerOffset(answerOffset + 50)} disabled={answerOffset + 50 >= answerTotal} className="text-[var(--c-secondary)] disabled:text-[var(--c-dark)]">NEXT →</button>
            </div>
          )}
        </div>
      )}

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          <div className="term-border overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)]">
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">MODE</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">SCORE</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">CARDS</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">STATUS</th>
                  <th className="px-2 py-2 text-left text-[var(--c-secondary)]">DATE</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id} className="border-b border-[color-mix(in_srgb,var(--c-primary)_5%,transparent)]">
                    <td className="px-2 py-1.5 text-[var(--c-secondary)]">{s.game_mode}{s.is_daily_challenge ? ' (daily)' : ''}</td>
                    <td className="px-2 py-1.5 text-[var(--c-accent)]">{s.final_score ?? '—'}</td>
                    <td className="px-2 py-1.5 text-[var(--c-muted)]">{s.cards_answered ?? 0}</td>
                    <td className={`px-2 py-1.5 ${s.completed_at ? 'text-[var(--c-primary)]' : 'text-[var(--c-dark)]'}`}>{s.completed_at ? 'DONE' : 'ABANDONED'}</td>
                    <td className="px-2 py-1.5 text-[var(--c-dark)]">{new Date(s.started_at).toLocaleString()}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-6 text-center text-[var(--c-muted)]">No sessions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {sessionTotal > 50 && (
            <div className="flex items-center justify-between text-xs font-mono">
              <button onClick={() => setSessionOffset(Math.max(0, sessionOffset - 50))} disabled={sessionOffset === 0} className="text-[var(--c-secondary)] disabled:text-[var(--c-dark)]">← PREV</button>
              <span className="text-[var(--c-muted)]">{sessionOffset + 1}–{Math.min(sessionOffset + 50, sessionTotal)} of {sessionTotal}</span>
              <button onClick={() => setSessionOffset(sessionOffset + 50)} disabled={sessionOffset + 50 >= sessionTotal} className="text-[var(--c-secondary)] disabled:text-[var(--c-dark)]">NEXT →</button>
            </div>
          )}
        </div>
      )}

      {/* Achievements tab */}
      {tab === 'achievements' && (
        <div className="space-y-4">
          {/* Grant */}
          <div className="term-border px-4 py-3">
            <div className="text-[var(--c-accent)] text-xs font-mono tracking-widest mb-2">GRANT ACHIEVEMENT</div>
            <div className="flex gap-2">
              <select
                value={grantId}
                onChange={(e) => setGrantId(e.target.value)}
                className="flex-1 bg-[var(--c-bg)] border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] px-2 py-2 text-[var(--c-primary)] font-mono text-xs focus:outline-none"
              >
                <option value="">Select achievement...</option>
                {unearnedAchievements.map((a) => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name} ({a.rarity})</option>
                ))}
              </select>
              <button
                onClick={grantAchievement}
                disabled={!grantId}
                className="px-4 py-2 term-border text-[var(--c-accent)] font-mono text-xs tracking-widest hover:bg-[color-mix(in_srgb,var(--c-accent)_5%,transparent)] disabled:opacity-40 transition-all"
              >
                GRANT
              </button>
            </div>
          </div>

          {/* Earned */}
          <div className="term-border px-4 py-3">
            <div className="text-[var(--c-secondary)] text-xs font-mono tracking-widest mb-2">EARNED ({data.achievements.length})</div>
            <div className="space-y-1">
              {data.achievements.map((ea) => {
                const def = ACHIEVEMENTS.find((a) => a.id === ea.id);
                if (!def) return null;
                return (
                  <div key={ea.id} className="flex items-center justify-between py-1 border-b border-[color-mix(in_srgb,var(--c-primary)_5%,transparent)]">
                    <div className="flex items-center gap-2">
                      <span style={{ color: RARITY_COLORS[def.rarity as AchievementRarity] }}>{def.icon}</span>
                      <span className="text-[var(--c-secondary)] text-xs font-mono">{def.name}</span>
                      <span className="text-[var(--c-dark)] text-[10px] font-mono">{def.rarity}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--c-dark)] text-[10px] font-mono">{new Date(ea.unlockedAt).toLocaleDateString()}</span>
                      <button
                        onClick={() => revokeAchievement(ea.id)}
                        className="text-[#ff3333] text-[10px] font-mono hover:underline"
                      >
                        REVOKE
                      </button>
                    </div>
                  </div>
                );
              })}
              {data.achievements.length === 0 && (
                <div className="text-[var(--c-muted)] text-xs font-mono py-2">No achievements earned</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comms tab */}
      {tab === 'comms' && (
        <div className="term-border px-4 py-3 space-y-3">
          <div className="text-[var(--c-accent)] text-xs font-mono tracking-widest">SEND SIGINT MESSAGE</div>
          <div className="text-[var(--c-muted)] text-xs font-mono">
            This will show as a full-screen SIGINT overlay next time this player loads the game.
          </div>
          <textarea
            value={msgLines}
            onChange={(e) => setMsgLines(e.target.value)}
            placeholder="One line per message. Each line shows as a separate SIGINT dialogue line."
            rows={4}
            className="w-full bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] px-3 py-2 text-[var(--c-primary)] font-mono text-sm placeholder:text-[var(--c-dark)] focus:outline-none focus:border-[color-mix(in_srgb,var(--c-primary)_50%,transparent)] resize-none"
          />
          <div className="flex items-center gap-3">
            <span className="text-[var(--c-secondary)] text-xs font-mono shrink-0">BUTTON TEXT</span>
            <input
              type="text"
              value={msgButton}
              onChange={(e) => setMsgButton(e.target.value)}
              className="flex-1 bg-transparent border border-[color-mix(in_srgb,var(--c-primary)_20%,transparent)] px-2 py-1.5 text-[var(--c-primary)] font-mono text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={async () => {
              const lines = msgLines.split('\n').filter((l) => l.trim());
              if (lines.length === 0) return;
              setSendingMsg(true);
              const res = await fetch('/api/admin/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetPlayerId: id, lines, buttonText: msgButton || 'ACKNOWLEDGED' }),
              });
              if (res.ok) { setActionMsg('MESSAGE SENT'); setMsgLines(''); }
              else setActionMsg('SEND FAILED');
              setSendingMsg(false);
            }}
            disabled={sendingMsg || !msgLines.trim()}
            className="w-full py-3 term-border text-[var(--c-accent)] font-mono text-xs tracking-widest hover:bg-[color-mix(in_srgb,var(--c-accent)_5%,transparent)] disabled:opacity-40 transition-all"
          >
            {sendingMsg ? 'SENDING...' : '[ SEND TO THIS PLAYER ]'}
          </button>
        </div>
      )}
    </div>
  );
}
