import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const supabase = getSupabaseAdminClient();

    const { data: flags, error } = await supabase
      .from('card_flags')
      .select('id, card_id, session_id, reason, comment, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
    }

    // Group by card_id for summary
    const byCard: Record<string, {
      card_id: string;
      count: number;
      reasons: Record<string, number>;
      comments: string[];
      latest: string;
    }> = {};

    for (const f of flags ?? []) {
      if (!byCard[f.card_id]) {
        byCard[f.card_id] = {
          card_id: f.card_id,
          count: 0,
          reasons: {},
          comments: [],
          latest: f.created_at,
        };
      }
      const entry = byCard[f.card_id];
      entry.count++;
      if (f.reason) {
        entry.reasons[f.reason] = (entry.reasons[f.reason] ?? 0) + 1;
      }
      if (f.comment) {
        entry.comments.push(f.comment);
      }
      if (f.created_at > entry.latest) {
        entry.latest = f.created_at;
      }
    }

    // Sort by flag count descending
    const grouped = Object.values(byCard).sort((a, b) => b.count - a.count);

    // Fetch card details for flagged cards
    const cardIds = grouped.map(g => g.card_id);
    let cardDetails: Record<string, { subject: string | null; from_address: string; is_phishing: boolean }> = {};

    if (cardIds.length > 0) {
      const { data: cards } = await supabase
        .from('cards_real')
        .select('card_id, subject, from_address, is_phishing')
        .in('card_id', cardIds);

      for (const c of cards ?? []) {
        cardDetails[c.card_id] = {
          subject: c.subject,
          from_address: c.from_address,
          is_phishing: c.is_phishing,
        };
      }
    }

    return NextResponse.json({
      totalFlags: (flags ?? []).length,
      flaggedCards: grouped.length,
      cards: grouped.map(g => ({
        ...g,
        ...cardDetails[g.card_id],
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
