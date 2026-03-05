import Link from 'next/link';
import { getSupabaseAdminClient } from '@/lib/supabase';

const TECHNIQUES = ['urgency', 'authority-impersonation', 'credential-harvest', 'hyper-personalization', 'pretexting', 'fluent-prose'];
const LEGIT_CATEGORIES = ['transactional', 'marketing', 'workplace'];

async function getStats() {
  try {
    const supabase = getSupabaseAdminClient();

    const [pending, approved, rejected, needsReview, real, breakdownResult] = await Promise.all([
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'needs_review'),
      supabase.from('cards_real').select('id', { count: 'exact', head: true }),
      supabase.from('cards_staging').select('suggested_technique, suggested_difficulty, is_phishing').eq('status', 'pending'),
    ]);

    const phishingBreakdown: Record<string, Record<string, number>> = {};
    const legitBreakdown: Record<string, number> = {};
    for (const t of TECHNIQUES) phishingBreakdown[t] = { easy: 0, medium: 0, hard: 0 };
    for (const c of LEGIT_CATEGORIES) legitBreakdown[c] = 0;

    for (const row of (breakdownResult.data ?? [])) {
      if (row.is_phishing && row.suggested_technique && row.suggested_difficulty) {
        if (phishingBreakdown[row.suggested_technique]?.[row.suggested_difficulty] !== undefined) {
          phishingBreakdown[row.suggested_technique][row.suggested_difficulty]++;
        }
      } else if (!row.is_phishing) {
        if (row.suggested_technique && row.suggested_technique in legitBreakdown) {
          legitBreakdown[row.suggested_technique]++;
        }
      }
    }

    const legitTotal = (breakdownResult.data ?? []).filter(r => !r.is_phishing).length;

    return {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      needsReview: needsReview.count ?? 0,
      liveCards: real.count ?? 0,
      targetCards: 550,
      pendingBreakdown: { phishing: phishingBreakdown, legit: legitBreakdown, legitTotal },
    };
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const stats = await getStats();
  const progress = stats ? Math.round((stats.liveCards / stats.targetCards) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#060c06] p-4 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-4 mt-8">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2 flex items-center justify-between">
            <span className="text-[#00aa28] text-xs tracking-widest">ADMIN_DASHBOARD</span>
            <Link href="/" className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28]">← BACK</Link>
          </div>
          <div className="px-3 py-4 space-y-4">
            {stats ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'PENDING', value: stats.pending, color: 'text-[#ffaa00]' },
                    { label: 'APPROVED', value: stats.approved, color: 'text-[#00ff41]' },
                    { label: 'REJECTED', value: stats.rejected, color: 'text-[#ff3333]' },
                    { label: 'NEEDS REVIEW', value: stats.needsReview, color: 'text-[#ffaa00]' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="term-border px-3 py-2 text-center">
                      <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
                      <div className="text-[10px] font-mono text-[#003a0e] mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#00aa28]">DATASET v1 PROGRESS</span>
                    <span className="text-[#00ff41]">{stats.liveCards} / {stats.targetCards}</span>
                  </div>
                  <div className="w-full h-2 bg-[#003a0e]">
                    <div
                      className="h-full bg-[#00ff41] transition-all"
                      style={{ width: `${progress}%`, boxShadow: '0 0 6px rgba(0,255,65,0.8)' }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-[#003a0e] text-right">{progress}% COMPLETE</div>
                </div>

                {stats.pendingBreakdown && (
                  <div className="space-y-2">
                    <div className="text-[#003a0e] text-xs font-mono tracking-widest">PENDING QUEUE — PHISHING</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr>
                            <th className="text-left text-[#003a0e] pb-1 pr-3">TECHNIQUE</th>
                            {['easy', 'medium', 'hard'].map(d => (
                              <th key={d} className="text-[#003a0e] pb-1 px-2 text-center w-12">{d.toUpperCase()}</th>
                            ))}
                            <th className="text-[#003a0e] pb-1 px-2 text-center w-12">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['urgency', 'authority-impersonation', 'credential-harvest', 'hyper-personalization', 'pretexting', 'fluent-prose'].map(technique => {
                            const row = stats.pendingBreakdown.phishing[technique] ?? {};
                            const total = (row.easy ?? 0) + (row.medium ?? 0) + (row.hard ?? 0);
                            return (
                              <tr key={technique} className="border-t border-[rgba(0,255,65,0.08)]">
                                <td className="text-[#00aa28] pr-3 py-1 truncate max-w-[120px]">{technique}</td>
                                {['easy', 'medium', 'hard'].map(d => {
                                  const count = row[d] ?? 0;
                                  const color = count === 0 ? 'text-[#003a0e]' : count >= 20 ? 'text-[#00ff41]' : 'text-[#ffaa00]';
                                  return <td key={d} className={`${color} text-center px-2 py-1 font-black`}>{count}</td>;
                                })}
                                <td className={`text-center px-2 py-1 font-black ${total === 0 ? 'text-[#003a0e]' : 'text-[#00aa28]'}`}>{total}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {stats.pendingBreakdown && (
                  <div className="space-y-2">
                    <div className="text-[#003a0e] text-xs font-mono tracking-widest">PENDING QUEUE — LEGIT</div>
                    <div className="term-border px-3 py-2 flex items-center justify-between">
                      <span className="text-[#003a0e] text-xs font-mono">TOTAL PENDING</span>
                      <span className={`text-xl font-black font-mono ${stats.pendingBreakdown.legitTotal === 0 ? 'text-[#003a0e]' : 'text-[#ffaa00]'}`}>
                        {stats.pendingBreakdown.legitTotal}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-[#00aa28] text-xs font-mono text-center py-4">
                SUPABASE NOT CONNECTED — set env vars to enable
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Link
            href="/admin/review"
            className="block w-full py-3 term-border text-[#00ff41] font-mono font-bold tracking-widest text-sm text-center hover:bg-[rgba(0,255,65,0.08)] transition-all glow"
          >
            [ REVIEW QUEUE ]
          </Link>
          <Link
            href="/admin/approved"
            className="block w-full py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
          >
            [ APPROVED CARDS ]
          </Link>
          <div className="flex gap-2">
            <Link
              href="/api/admin/export?format=json"
              className="flex-1 py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
            >
              [ JSON ]
            </Link>
            <Link
              href="/api/admin/export?format=csv"
              className="flex-1 py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
            >
              [ CSV ]
            </Link>
            <Link
              href="/api/admin/export?format=jsonl"
              className="flex-1 py-3 term-border text-[#00aa28] font-mono text-xs tracking-widest text-center hover:bg-[rgba(0,255,65,0.05)] transition-all"
            >
              [ JSONL ]
            </Link>
          </div>
          <Link
            href="/admin/preview"
            className="block w-full py-3 term-border text-[#ffaa00] font-mono text-xs tracking-widest text-center hover:bg-[rgba(255,170,0,0.05)] transition-all"
          >
            [ PREVIEW MODE — NO DATA WRITTEN ]
          </Link>
        </div>
      </div>
    </div>
  );
}
