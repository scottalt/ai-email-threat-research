import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';

async function getGraduatedAuthId(): Promise<{ authId: string | null; graduated: boolean }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authId: null, graduated: false };

  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('players')
    .select('research_graduated')
    .eq('auth_id', user.id)
    .single();

  return { authId: user.id, graduated: Boolean(data?.research_graduated) };
}

export async function GET(req: NextRequest) {
  // Rate limit: 10 requests per IP per minute
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rlKey = `ratelimit:cards-expert:${ip}`;
  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) await redis.expire(rlKey, 60);
  if (rlCount > 10) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { authId, graduated } = await getGraduatedAuthId();

  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!graduated) return NextResponse.json({ error: 'Expert mode not unlocked' }, { status: 403 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cards_real')
    .select('*')
    .eq('difficulty', 'extreme')
    .limit(500);

  if (error) return NextResponse.json([], { status: 200 });

  const rows = (data ?? []) as Record<string, unknown>[];
  const cards = rows.map((c) => ({
    id: c.card_id,
    type: c.type,
    difficulty: c.difficulty,
    isPhishing: c.is_phishing,
    from: c.from_address,
    subject: c.subject ?? undefined,
    body: c.body,
    clues: Array.isArray(c.clues) ? c.clues : [],
    highlights: Array.isArray(c.highlights) ? c.highlights : [],
    explanation: c.explanation,
    technique: c.technique ?? null,
    authStatus: c.auth_status ?? 'unverified',
    replyTo: c.reply_to ?? undefined,
    attachmentName: c.attachment_name ?? undefined,
    sentAt: c.sent_at ?? undefined,
    cardSource: 'real',
    secondaryTechnique: c.secondary_technique ?? null,
    isGenaiSuspected: c.is_genai_suspected ?? null,
    genaiConfidence: c.genai_confidence ?? null,
    grammarQuality: c.grammar_quality ?? null,
    proseFluency: c.prose_fluency ?? null,
    personalizationLevel: c.personalization_level ?? null,
    contextualCoherence: c.contextual_coherence ?? null,
    datasetVersion: c.dataset_version ?? 'v1',
  }));

  return NextResponse.json(cards);
}
