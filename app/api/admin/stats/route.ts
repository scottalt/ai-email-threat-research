import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();

    const [pending, approved, rejected, needsReview, real] = await Promise.all([
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('cards_staging').select('id', { count: 'exact', head: true }).eq('status', 'needs_review'),
      supabase.from('cards_real').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      needsReview: needsReview.count ?? 0,
      liveCards: real.count ?? 0,
      targetCards: 550,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
