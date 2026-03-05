import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

const TECHNIQUES = ['urgency', 'authority-impersonation', 'credential-harvest', 'hyper-personalization', 'pretexting', 'fluent-prose'];
const LEGIT_CATEGORIES = ['transactional', 'marketing', 'workplace'];

export async function GET() {
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

    for (const t of TECHNIQUES) {
      phishingBreakdown[t] = { easy: 0, medium: 0, hard: 0 };
    }
    for (const c of LEGIT_CATEGORIES) {
      legitBreakdown[c] = 0;
    }

    const rows = breakdownResult.data ?? [];
    for (const row of rows) {
      if (row.is_phishing && row.suggested_technique && row.suggested_difficulty) {
        if (phishingBreakdown[row.suggested_technique] && row.suggested_difficulty in phishingBreakdown[row.suggested_technique]) {
          phishingBreakdown[row.suggested_technique][row.suggested_difficulty]++;
        }
      } else if (!row.is_phishing && row.suggested_technique) {
        if (row.suggested_technique in legitBreakdown) {
          legitBreakdown[row.suggested_technique]++;
        }
      }
    }

    const legitTotal = rows.filter(r => !r.is_phishing).length;

    return NextResponse.json({
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      needsReview: needsReview.count ?? 0,
      liveCards: real.count ?? 0,
      targetCards: 1000,
      pendingBreakdown: { phishing: phishingBreakdown, legit: legitBreakdown, legitTotal },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
