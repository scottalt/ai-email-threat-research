'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────

interface DayDetail {
  date: string;
  sessionCount: number;
  xpEarned: number;
}

interface FlaggedPlayer {
  playerId: string;
  displayName: string | null;
  currentXp: number;
  currentLevel: number;
  legitimateXp: number;
  suspiciousXp: number;
  totalSessionsInWindow: number;
  peakSessionsPerDay: number;
  peakDate: string;
  days: DayDetail[];
}

interface AuditData {
  flaggedPlayers: FlaggedPlayer[];
  totalSessions: number;
  since: string;
  threshold: number;
}

interface RecalcResult {
  playerId: string;
  oldXp: number;
  newXp: number;
  oldLevel: number;
  newLevel: number;
}

type ConfirmStage = 'idle' | 'review' | 'confirm' | 'executing' | 'done';

// ── Component ──────────────────────────────────────────────────────

export default function XpAuditPage() {
  // Scan controls
  const [threshold, setThreshold] = useState('10');
  const [since, setSince] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });

  // Data
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Confirmation flow
  const [confirmStage, setConfirmStage] = useState<ConfirmStage>('idle');
  const [confirmText, setConfirmText] = useState('');

  // Results & undo
  const [recalcResults, setRecalcResults] = useState<RecalcResult[]>([]);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [undoComplete, setUndoComplete] = useState(false);

  // ── Scan ────────────────────────────────────────────────────────

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setSelected(new Set());
    setConfirmStage('idle');
    setRecalcResults([]);
    setUndoAvailable(false);
    setUndoComplete(false);
    try {
      const res = await fetch(
        `/api/admin/xp-audit?threshold=${encodeURIComponent(threshold)}&since=${encodeURIComponent(since)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, [threshold, since]);

  // ── Selection helpers ──────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!data) return;
    setSelected(new Set(data.flaggedPlayers.map(p => p.playerId)));
  };

  const selectNone = () => setSelected(new Set());

  // ── Recalculate with multi-step confirmation ───────────────────

  const startRecalc = () => {
    if (selected.size === 0) return;
    setConfirmStage('review');
    setConfirmText('');
  };

  const proceedToConfirm = () => setConfirmStage('confirm');

  const executeRecalc = async () => {
    if (confirmText !== 'RECALCULATE') return;
    setConfirmStage('executing');
    try {
      const res = await fetch('/api/admin/xp-audit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: [...selected] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { results } = await res.json();
      setRecalcResults(results);
      setUndoAvailable(true);
      setConfirmStage('done');

      // Refresh the scan data to show updated XP
      const scanRes = await fetch(
        `/api/admin/xp-audit?threshold=${encodeURIComponent(threshold)}&since=${encodeURIComponent(since)}`
      );
      if (scanRes.ok) setData(await scanRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recalculation failed');
      setConfirmStage('idle');
    }
  };

  const cancelRecalc = () => {
    setConfirmStage('idle');
    setConfirmText('');
  };

  // ── Undo ───────────────────────────────────────────────────────

  const executeUndo = async () => {
    if (recalcResults.length === 0) return;
    const restorations = recalcResults.map(r => ({
      playerId: r.playerId,
      xp: r.oldXp,
      level: r.oldLevel,
    }));
    try {
      const res = await fetch('/api/admin/xp-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restorations }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUndoComplete(true);
      setUndoAvailable(false);

      // Refresh scan
      const scanRes = await fetch(
        `/api/admin/xp-audit?threshold=${encodeURIComponent(threshold)}&since=${encodeURIComponent(since)}`
      );
      if (scanRes.ok) setData(await scanRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Undo failed');
    }
  };

  // ── Render ─────────────────────────────────────────────────────

  const selectedPlayers = data?.flaggedPlayers.filter(p => selected.has(p.playerId)) ?? [];
  const totalSuspiciousXp = selectedPlayers.reduce((sum, p) => sum + p.suspiciousXp, 0);

  return (
    <div className="min-h-screen bg-[#060c06] p-4">
      <div className="max-w-2xl mx-auto space-y-4 mt-8">

        {/* Header */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#ff3333] tracking-widest">XP_AUDIT</span>
          <Link href="/admin" className="text-[#003a0e] hover:text-[#00aa28] transition-colors">
            &larr; BACK
          </Link>
        </div>

        {/* Scan controls */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2">
            <span className="text-[#00aa28] text-xs tracking-widest">SCAN_PARAMETERS</span>
          </div>
          <div className="px-3 py-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#003a0e] text-[10px] font-mono tracking-widest block mb-1">
                  SESSIONS/DAY THRESHOLD
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-sm px-2 py-1.5 focus:outline-none focus:border-[#00ff41]"
                />
              </div>
              <div>
                <label className="text-[#003a0e] text-[10px] font-mono tracking-widest block mb-1">
                  LOOK BACK SINCE
                </label>
                <input
                  type="date"
                  value={since}
                  onChange={e => setSince(e.target.value)}
                  className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-sm px-2 py-1.5 focus:outline-none focus:border-[#00ff41]"
                />
              </div>
            </div>
            <button
              onClick={runScan}
              disabled={loading}
              className="w-full py-2 term-border text-[#00ff41] font-mono font-bold text-sm tracking-widest hover:bg-[rgba(0,255,65,0.08)] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? '[ SCANNING... ]' : '[ RUN SCAN ]'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="term-border border-[rgba(255,51,51,0.4)] bg-[#060c06] px-3 py-2 text-[#ff3333] text-xs font-mono">
            ERROR: {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="term-border px-2 py-2 text-center">
                <div className="text-xl font-black font-mono text-[#00ff41]">{data.totalSessions}</div>
                <div className="text-[10px] font-mono text-[#003a0e]">SESSIONS SCANNED</div>
              </div>
              <div className="term-border border-[rgba(255,51,51,0.2)] px-2 py-2 text-center">
                <div className="text-xl font-black font-mono text-[#ff3333]">{data.flaggedPlayers.length}</div>
                <div className="text-[10px] font-mono text-[#003a0e]">PLAYERS FLAGGED</div>
              </div>
              <div className="term-border px-2 py-2 text-center">
                <div className="text-xl font-black font-mono text-[#ffaa00]">{data.threshold}</div>
                <div className="text-[10px] font-mono text-[#003a0e]">THRESHOLD</div>
              </div>
            </div>

            {data.flaggedPlayers.length === 0 ? (
              <div className="term-border bg-[#060c06] px-4 py-8 text-center text-[#00ff41] font-mono text-xs">
                NO SUSPICIOUS ACTIVITY DETECTED
              </div>
            ) : (
              <>
                {/* Bulk select */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button onClick={selectAll} className="text-[#00aa28] hover:text-[#00ff41] transition-colors">
                    [SELECT ALL]
                  </button>
                  <button onClick={selectNone} className="text-[#003a0e] hover:text-[#00aa28] transition-colors">
                    [CLEAR]
                  </button>
                  <span className="ml-auto text-[#003a0e]">
                    {selected.size} of {data.flaggedPlayers.length} selected
                  </span>
                </div>

                {/* Player list */}
                <div className="space-y-1">
                  {data.flaggedPlayers.map(player => (
                    <div key={player.playerId} className="term-border bg-[#060c06]">
                      {/* Row header */}
                      <div className="flex items-center gap-2 px-3 py-2 text-xs font-mono">
                        <input
                          type="checkbox"
                          checked={selected.has(player.playerId)}
                          onChange={() => toggleSelect(player.playerId)}
                          className="accent-[#ff3333] shrink-0"
                        />
                        <button
                          onClick={() => toggleExpand(player.playerId)}
                          className="flex-1 flex items-center gap-2 text-left hover:bg-[rgba(255,51,51,0.03)] transition-all min-w-0"
                        >
                          <span className="text-[#00ff41] font-bold truncate">
                            {player.displayName ?? player.playerId.slice(0, 8)}
                          </span>
                          <span className="text-[#003a0e] shrink-0">Lv{player.currentLevel}</span>
                          <span className="text-[#ffaa00] font-black shrink-0">
                            {player.currentXp} XP
                          </span>
                          <span className="text-[#ff3333] font-black shrink-0 ml-auto">
                            ~{player.suspiciousXp} sus
                          </span>
                          <span className="text-[#003a0e] shrink-0">
                            {player.peakSessionsPerDay}x peak
                          </span>
                          <span className="text-[#003a0e] text-[10px] shrink-0">
                            {expanded.has(player.playerId) ? '\u25B2' : '\u25BC'}
                          </span>
                        </button>
                      </div>

                      {/* Expanded detail */}
                      {expanded.has(player.playerId) && (
                        <div className="border-t border-[rgba(255,51,51,0.15)] px-3 py-3 space-y-3">
                          {/* Stats grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                            <div>
                              <span className="text-[#003a0e]">PLAYER ID: </span>
                              <span className="text-[#00aa28] break-all">{player.playerId}</span>
                            </div>
                            <div>
                              <span className="text-[#003a0e]">DISPLAY NAME: </span>
                              <span className="text-[#00aa28]">{player.displayName ?? '(none)'}</span>
                            </div>
                            <div>
                              <span className="text-[#003a0e]">CURRENT XP: </span>
                              <span className="text-[#ffaa00] font-bold">{player.currentXp}</span>
                            </div>
                            <div>
                              <span className="text-[#003a0e]">LEVEL: </span>
                              <span className="text-[#ffaa00] font-bold">{player.currentLevel}</span>
                            </div>
                            <div>
                              <span className="text-[#003a0e]">LEGITIMATE XP: </span>
                              <span className="text-[#00ff41] font-bold">{player.legitimateXp}</span>
                            </div>
                            <div>
                              <span className="text-[#003a0e]">SUSPICIOUS XP: </span>
                              <span className="text-[#ff3333] font-bold">{player.suspiciousXp}</span>
                            </div>
                            <div>
                              <span className="text-[#003a0e]">TOTAL SESSIONS: </span>
                              <span className="text-[#00aa28]">{player.totalSessionsInWindow}</span>
                            </div>
                            <div>
                              <span className="text-[#003a0e]">PEAK DAY: </span>
                              <span className="text-[#ff3333] font-bold">
                                {player.peakSessionsPerDay} sessions on {player.peakDate}
                              </span>
                            </div>
                          </div>

                          {/* Day breakdown */}
                          <div className="space-y-1">
                            <div className="text-[#003a0e] text-[10px] font-mono tracking-widest">
                              DAILY BREAKDOWN
                            </div>
                            <div className="space-y-0.5">
                              {player.days.map(day => {
                                const overThreshold = day.sessionCount > data.threshold;
                                return (
                                  <div key={day.date} className="flex items-center gap-2 text-xs font-mono">
                                    <span className="text-[#003a0e] w-20 shrink-0">{day.date}</span>
                                    <div className="flex-1 h-1.5 bg-[#003a0e]">
                                      <div
                                        className={`h-full ${overThreshold ? 'bg-[#ff3333]' : 'bg-[#00ff41]'}`}
                                        style={{
                                          width: `${Math.min(100, (day.sessionCount / player.peakSessionsPerDay) * 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className={`w-8 text-right font-black shrink-0 ${overThreshold ? 'text-[#ff3333]' : 'text-[#00aa28]'}`}>
                                      {day.sessionCount}
                                    </span>
                                    <span className="text-[#003a0e] text-[10px] w-16 text-right shrink-0">
                                      {day.xpEarned} XP
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Recalculate action */}
                {confirmStage === 'idle' && selected.size > 0 && (
                  <button
                    onClick={startRecalc}
                    className="w-full py-3 term-border border-[rgba(255,51,51,0.4)] text-[#ff3333] font-mono font-bold text-sm tracking-widest hover:bg-[rgba(255,51,51,0.08)] active:scale-[0.98] transition-all"
                  >
                    [ RECALCULATE XP FOR {selected.size} PLAYER{selected.size > 1 ? 'S' : ''} ]
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* ── Confirmation Step 1: Review ──────────────────────── */}
        {confirmStage === 'review' && (
          <div className="term-border border-[rgba(255,170,0,0.4)] bg-[#060c06]">
            <div className="border-b border-[rgba(255,170,0,0.35)] px-3 py-2">
              <span className="text-[#ffaa00] text-xs tracking-widest">STEP 1/3 — REVIEW SELECTION</span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <div className="text-xs font-mono text-[#00aa28] space-y-1">
                <p>You are about to recalculate XP for <span className="text-[#ffaa00] font-bold">{selected.size}</span> player{selected.size > 1 ? 's' : ''}.</p>
                <p>Estimated suspicious XP to remove: <span className="text-[#ff3333] font-bold">{totalSuspiciousXp} XP</span></p>
                <p className="text-[#003a0e] mt-2">This will recompute each player&apos;s total XP from their actual answer records. Any XP not backed by real answers will be removed.</p>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selectedPlayers.map(p => (
                  <div key={p.playerId} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-[#00ff41] truncate flex-1">{p.displayName ?? p.playerId.slice(0, 8)}</span>
                    <span className="text-[#ffaa00]">{p.currentXp} XP</span>
                    <span className="text-[#ff3333]">-{p.suspiciousXp} est.</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelRecalc}
                  className="flex-1 py-2 term-border text-[#003a0e] font-mono text-xs tracking-widest hover:text-[#00aa28] hover:bg-[rgba(0,255,65,0.05)] transition-all"
                >
                  [ CANCEL ]
                </button>
                <button
                  onClick={proceedToConfirm}
                  className="flex-1 py-2 term-border border-[rgba(255,170,0,0.4)] text-[#ffaa00] font-mono text-xs tracking-widest font-bold hover:bg-[rgba(255,170,0,0.08)] transition-all"
                >
                  [ PROCEED ]
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirmation Step 2: Type to confirm ─────────────── */}
        {confirmStage === 'confirm' && (
          <div className="term-border border-[rgba(255,51,51,0.4)] bg-[#060c06]">
            <div className="border-b border-[rgba(255,51,51,0.35)] px-3 py-2">
              <span className="text-[#ff3333] text-xs tracking-widest">STEP 2/3 — TYPE TO CONFIRM</span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <div className="text-xs font-mono text-[#ff3333]">
                <p>This action will modify player XP in the database.</p>
                <p className="text-[#003a0e] mt-1">An undo option will be available immediately after execution.</p>
              </div>
              <div>
                <label className="text-[#003a0e] text-[10px] font-mono tracking-widest block mb-1">
                  TYPE &quot;RECALCULATE&quot; TO CONFIRM
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="RECALCULATE"
                  className="w-full bg-[#060c06] border border-[rgba(255,51,51,0.3)] text-[#ff3333] font-mono text-sm px-2 py-1.5 focus:outline-none focus:border-[#ff3333] placeholder:text-[rgba(255,51,51,0.2)]"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelRecalc}
                  className="flex-1 py-2 term-border text-[#003a0e] font-mono text-xs tracking-widest hover:text-[#00aa28] hover:bg-[rgba(0,255,65,0.05)] transition-all"
                >
                  [ CANCEL ]
                </button>
                <button
                  onClick={executeRecalc}
                  disabled={confirmText !== 'RECALCULATE'}
                  className="flex-1 py-2 term-border border-[rgba(255,51,51,0.4)] text-[#ff3333] font-mono text-xs tracking-widest font-bold hover:bg-[rgba(255,51,51,0.08)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  [ EXECUTE ]
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Executing ────────────────────────────────────────── */}
        {confirmStage === 'executing' && (
          <div className="term-border border-[rgba(255,170,0,0.4)] bg-[#060c06] px-3 py-6 text-center">
            <span className="text-[#ffaa00] text-xs font-mono tracking-widest animate-pulse">
              RECALCULATING XP...
            </span>
          </div>
        )}

        {/* ── Results + Undo ───────────────────────────────────── */}
        {confirmStage === 'done' && recalcResults.length > 0 && (
          <div className="term-border border-[rgba(0,255,65,0.4)] bg-[#060c06]">
            <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2">
              <span className="text-[#00ff41] text-xs tracking-widest">STEP 3/3 — RESULTS</span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <div className="space-y-1">
                {recalcResults.map(r => {
                  const diff = r.newXp - r.oldXp;
                  const player = data?.flaggedPlayers.find(p => p.playerId === r.playerId);
                  return (
                    <div key={r.playerId} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-[#00ff41] truncate flex-1">
                        {player?.displayName ?? r.playerId.slice(0, 8)}
                      </span>
                      <span className="text-[#003a0e]">{r.oldXp}</span>
                      <span className="text-[#003a0e]">&rarr;</span>
                      <span className="text-[#ffaa00] font-bold">{r.newXp}</span>
                      <span className={`font-black ${diff < 0 ? 'text-[#ff3333]' : diff > 0 ? 'text-[#00ff41]' : 'text-[#003a0e]'}`}>
                        ({diff >= 0 ? '+' : ''}{diff})
                      </span>
                      <span className="text-[#003a0e] text-[10px]">
                        Lv{r.oldLevel}&rarr;{r.newLevel}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Undo */}
              {undoAvailable && !undoComplete && (
                <div className="term-border border-[rgba(255,170,0,0.4)] px-3 py-3 space-y-2">
                  <div className="text-xs font-mono text-[#ffaa00]">
                    Made a mistake? You can undo this action to restore the original XP values.
                  </div>
                  <button
                    onClick={executeUndo}
                    className="w-full py-2 term-border border-[rgba(255,170,0,0.4)] text-[#ffaa00] font-mono text-xs tracking-widest font-bold hover:bg-[rgba(255,170,0,0.08)] active:scale-[0.98] transition-all"
                  >
                    [ UNDO — RESTORE ORIGINAL XP ]
                  </button>
                </div>
              )}

              {undoComplete && (
                <div className="term-border border-[rgba(0,255,65,0.4)] px-3 py-2 text-center text-[#00ff41] text-xs font-mono">
                  UNDO COMPLETE — Original XP values restored.
                </div>
              )}

              <button
                onClick={() => {
                  setConfirmStage('idle');
                  setSelected(new Set());
                }}
                className="w-full py-2 term-border text-[#003a0e] font-mono text-xs tracking-widest hover:text-[#00aa28] transition-all"
              >
                [ DISMISS ]
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
