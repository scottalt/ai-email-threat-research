import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cards_real')
      .select('is_phishing, technique, difficulty');

    if (error) return NextResponse.json({ error: 'Failed to fetch breakdown' }, { status: 500 });

    const rows = data ?? [];

    // Build phishing breakdown: technique -> difficulty -> count
    const phishing: Record<string, Record<string, number>> = {};
    let legitCount = 0;

    for (const row of rows) {
      if (row.is_phishing) {
        const t = row.technique ?? 'unknown';
        const d = row.difficulty ?? 'unknown';
        if (!phishing[t]) phishing[t] = {};
        phishing[t][d] = (phishing[t][d] ?? 0) + 1;
      } else {
        legitCount++;
      }
    }

    return NextResponse.json({ phishing, legitCount });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
