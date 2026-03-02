import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET — fetch next pending card for review (random order) + approved count
export async function GET() {
  const supabase = getSupabaseAdminClient();

  const [{ count: pendingCount }, { count: approvedCount }] = await Promise.all([
    supabase.from('cards_staging').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('cards_real').select('*', { count: 'exact', head: true }),
  ]);

  if (!pendingCount) return NextResponse.json({ card: null, pendingCount: 0, approvedCount: approvedCount ?? 0 });

  const randomOffset = Math.floor(Math.random() * pendingCount);

  const { data, error } = await supabase
    .from('cards_staging')
    .select('*')
    .eq('status', 'pending')
    .range(randomOffset, randomOffset)
    .single();

  if (error) return NextResponse.json({ card: null, pendingCount: 0, approvedCount: approvedCount ?? 0 });

  return NextResponse.json({ card: data, pendingCount, approvedCount: approvedCount ?? 0 });
}

// POST — approve, reject, or mark needs_review
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const body = await req.json();
  const { action, stagingId, reviewedFields } = body;

  if (!['approved', 'rejected', 'needs_review'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  // Update staging status
  const { error: stagingError } = await supabase
    .from('cards_staging')
    .update({ status: action, reviewed_at: new Date().toISOString() })
    .eq('id', stagingId);

  if (stagingError) return NextResponse.json({ error: stagingError.message }, { status: 500 });

  // If approved, insert into cards_real
  if (action === 'approved' && reviewedFields) {
    const wordCount = reviewedFields.processed_body ? reviewedFields.processed_body.trim().split(/\s+/).length : 0;
    const charCount = reviewedFields.processed_body ? reviewedFields.processed_body.length : 0;

    const { error: realError } = await supabase.from('cards_real').insert({
      staging_id: stagingId,
      card_id: `real-${reviewedFields.is_phishing ? 'p' : 'l'}-${Date.now()}`,
      type: reviewedFields.inferred_type,
      is_phishing: reviewedFields.is_phishing,
      difficulty: reviewedFields.suggested_difficulty,
      from_address: reviewedFields.processed_from,
      subject: reviewedFields.processed_subject,
      body: reviewedFields.processed_body,
      word_count: wordCount,
      char_count: charCount,
      technique: reviewedFields.suggested_technique,
      source_corpus: reviewedFields.source_corpus,
      highlights: reviewedFields.suggested_highlights,
      clues: reviewedFields.suggested_clues,
      explanation: reviewedFields.suggested_explanation,
      review_notes: reviewedFields.review_notes ?? null,
      review_time_ms: reviewedFields.review_time_ms ?? null,
      ai_model: reviewedFields.ai_model,
      ai_preprocessing_version: reviewedFields.ai_preprocessing_version,
    });

    if (realError) return NextResponse.json({ error: realError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
