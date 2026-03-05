import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET — fetch next pending card for review (random within filtered set) + counts
// Filters: ?technique=urgency&difficulty=hard&phishing=true&attachment=true
export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(req.url);

  const filterTechnique = searchParams.get('technique');
  const filterDifficulty = searchParams.get('difficulty');
  const filterPhishing = searchParams.get('phishing'); // 'true' | 'false' | null
  const filterAttachment = searchParams.get('attachment'); // 'true' | 'false' | null

  // Build a filtered count query
  let countQuery = supabase
    .from('cards_staging')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (filterTechnique) countQuery = countQuery.eq('suggested_technique', filterTechnique);
  if (filterDifficulty) countQuery = countQuery.eq('suggested_difficulty', filterDifficulty);
  if (filterPhishing === 'true') countQuery = countQuery.eq('is_phishing', true);
  if (filterPhishing === 'false') countQuery = countQuery.eq('is_phishing', false);
  if (filterAttachment === 'true') countQuery = countQuery.not('suggested_attachment_name', 'is', null);
  if (filterAttachment === 'false') countQuery = countQuery.is('suggested_attachment_name', null);

  const [{ count: filteredCount }, { count: approvedCount }] = await Promise.all([
    countQuery,
    supabase.from('cards_real').select('*', { count: 'exact', head: true }),
  ]);

  if (!filteredCount) return NextResponse.json({ card: null, pendingCount: 0, approvedCount: approvedCount ?? 0 });

  const randomOffset = Math.floor(Math.random() * filteredCount);

  // Fetch a random card from the filtered set
  let cardQuery = supabase
    .from('cards_staging')
    .select('*')
    .eq('status', 'pending');
  if (filterTechnique) cardQuery = cardQuery.eq('suggested_technique', filterTechnique);
  if (filterDifficulty) cardQuery = cardQuery.eq('suggested_difficulty', filterDifficulty);
  if (filterPhishing === 'true') cardQuery = cardQuery.eq('is_phishing', true);
  if (filterPhishing === 'false') cardQuery = cardQuery.eq('is_phishing', false);
  if (filterAttachment === 'true') cardQuery = cardQuery.not('suggested_attachment_name', 'is', null);
  if (filterAttachment === 'false') cardQuery = cardQuery.is('suggested_attachment_name', null);

  const { data, error } = await cardQuery.range(randomOffset, randomOffset).single();

  if (error) return NextResponse.json({ card: null, pendingCount: 0, approvedCount: approvedCount ?? 0 });

  return NextResponse.json({ card: data, pendingCount: filteredCount, approvedCount: approvedCount ?? 0 });
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

    const isPhishing = Boolean(reviewedFields.is_phishing);
    const validDifficulties = ['easy', 'medium', 'hard', 'extreme'];
    const difficulty = isPhishing && validDifficulties.includes(reviewedFields.suggested_difficulty)
      ? reviewedFields.suggested_difficulty : null;

    const authStatus = reviewedFields.auth_status ??
      (!isPhishing ? 'verified'
        : ['easy', 'medium'].includes(difficulty) ? 'fail'
        : 'unverified');

    const { error: realError } = await supabase.from('cards_real').insert({
      staging_id: stagingId,
      card_id: `real-${isPhishing ? 'p' : 'l'}-${Date.now()}`,
      type: reviewedFields.inferred_type,
      is_phishing: isPhishing,
      difficulty,
      from_address: reviewedFields.processed_from,
      subject: reviewedFields.processed_subject,
      body: reviewedFields.processed_body,
      word_count: wordCount,
      char_count: charCount,
      technique: reviewedFields.suggested_technique,
      secondary_technique: reviewedFields.suggested_secondary_technique ?? null,
      source_corpus: reviewedFields.source_corpus,
      highlights: reviewedFields.suggested_highlights,
      clues: reviewedFields.suggested_clues,
      explanation: reviewedFields.suggested_explanation,
      review_notes: reviewedFields.review_notes ?? null,
      review_time_ms: reviewedFields.review_time_ms ?? null,
      ai_model: reviewedFields.ai_model,
      ai_preprocessing_version: reviewedFields.ai_preprocessing_version,
      auth_status: authStatus,
      reply_to: reviewedFields.reply_to ?? null,
      attachment_name: reviewedFields.attachment_name ?? null,
      sent_at: reviewedFields.suggested_sent_at ?? null,
      dataset_version: 'v1',
    });

    if (realError) return NextResponse.json({ error: realError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
