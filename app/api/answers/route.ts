import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { AnswerEvent, SessionPayload } from '@/lib/types';

async function getPlayerId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = getSupabaseAdminClient();
    const { data } = await admin.from('players').select('id').eq('auth_id', user.id).single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

const VALID_ANSWERS = ['phishing', 'legit'] as const;
const VALID_CONFIDENCES = ['guessing', 'likely', 'certain'] as const;
const VALID_MODES = ['research', 'freeplay', 'daily', 'preview', 'expert'] as const;
const MAX_RESEARCH_ANSWERS = 10;

export async function POST(req: NextRequest) {
  try {
    const body: { answer: AnswerEvent; session: SessionPayload } = await req.json();

    // Basic validation — reject obviously malformed payloads
    const a = body?.answer;
    if (
      !a ||
      typeof a.sessionId !== 'string' || a.sessionId.length > 100 ||
      typeof a.cardId !== 'string' || !a.cardId ||
      !(VALID_ANSWERS as readonly string[]).includes(a.userAnswer) ||
      !(VALID_CONFIDENCES as readonly string[]).includes(a.confidence) ||
      !(VALID_MODES as readonly string[]).includes(a.gameMode) ||
      typeof a.correct !== 'boolean' ||
      typeof a.isPhishing !== 'boolean'
    ) {
      return NextResponse.json({ ok: true }); // silent reject — don't break the game
    }

    // Preview mode — never write to DB
    if (a.gameMode === 'preview') {
      return NextResponse.json({ ok: true });
    }

    // Research and expert modes require authentication — silently skip unauthenticated answers
    const playerId = await getPlayerId();
    if ((a.gameMode === 'research' || a.gameMode === 'expert') && !playerId) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdminClient();

    // Research mode: verify correct and technique server-side + session dedup
    let verifiedCorrect = a.correct;
    let verifiedIsPhishing = a.isPhishing;
    let verifiedTechnique = a.technique;

    if (a.gameMode === 'research') {
      // Session dedup: reject if session already has MAX_RESEARCH_ANSWERS research answers
      const { count } = await supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', a.sessionId)
        .eq('game_mode', 'research');

      if ((count ?? 0) >= MAX_RESEARCH_ANSWERS) {
        return NextResponse.json({ ok: true }); // silent reject
      }

      // Look up card in cards_real to recompute correct and technique server-side
      const { data: card } = await supabase
        .from('cards_real')
        .select('is_phishing, technique')
        .eq('card_id', a.cardId)
        .single();

      if (card) {
        verifiedIsPhishing = card.is_phishing;
        verifiedTechnique = card.technique;
        verifiedCorrect = (a.userAnswer === 'phishing') === card.is_phishing;
      }
    }

    // Insert answer event
    const { error: answerError } = await supabase.from('answers').insert({
      player_id: playerId ?? null,
      session_id: a.sessionId,
      card_id: a.cardId,
      card_source: a.cardSource,
      is_phishing: verifiedIsPhishing,
      technique: verifiedTechnique,
      secondary_technique: a.secondaryTechnique,
      is_genai_suspected: a.isGenaiSuspected,
      genai_confidence: a.genaiConfidence,
      grammar_quality: a.grammarQuality,
      prose_fluency: a.proseFluency,
      personalization_level: a.personalizationLevel,
      contextual_coherence: a.contextualCoherence,
      difficulty: a.difficulty,
      type: a.type,
      user_answer: a.userAnswer,
      correct: verifiedCorrect,
      confidence: a.confidence,
      time_from_render_ms: a.timeFromRenderMs,
      time_from_confidence_ms: a.timeFromConfidenceMs,
      confidence_selection_time_ms: a.confidenceSelectionTimeMs,
      scroll_depth_pct: a.scrollDepthPct,
      answer_method: a.answerMethod,
      answer_ordinal: a.answerOrdinal,
      streak_at_answer_time: a.streakAtAnswerTime,
      correct_count_at_time: a.correctCountAtTime,
      game_mode: a.gameMode,
      is_daily_challenge: a.isDailyChallenge,
      dataset_version: a.datasetVersion,
      headers_opened: a.headersOpened,
      url_inspected: a.urlInspected,
      auth_status: a.authStatusSignal,
      has_reply_to: a.hasReplyTo,
      has_url: a.hasUrl,
      has_attachment: a.hasAttachment,
      has_sent_at: a.hasSentAt,
    });

    if (answerError) console.error('Answer insert failed:', answerError);

    // Upsert session — runs independently regardless of answer insert result
    const s = body.session;
    const { error: sessionError } = await supabase.from('sessions').upsert({
      session_id: s.sessionId,
      game_mode: s.gameMode,
      is_daily_challenge: s.isDailyChallenge,
      started_at: s.startedAt,
      completed_at: s.completedAt,
      cards_answered: s.cardsAnswered,
      final_score: s.finalScore,
      final_rank: s.finalRank,
      device_type: s.deviceType,
      viewport_width: s.viewportWidth,
      viewport_height: s.viewportHeight,
      referrer: s.referrer,
    }, { onConflict: 'session_id' });

    if (sessionError) console.error('Session upsert failed:', sessionError);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Silently fail — never break the game over analytics
    console.error('Answer logging failed:', err);
    return NextResponse.json({ ok: true });
  }
}
