import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import type { AnswerEvent, SessionPayload } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: { answer: AnswerEvent; session: SessionPayload } = await req.json();
    const supabase = getSupabaseAdminClient();

    // Insert answer event
    const { error: answerError } = await supabase.from('answers').insert({
      session_id: body.answer.sessionId,
      card_id: body.answer.cardId,
      card_source: body.answer.cardSource,
      is_phishing: body.answer.isPhishing,
      technique: body.answer.technique,
      secondary_technique: body.answer.secondaryTechnique,
      is_genai_suspected: body.answer.isGenaiSuspected,
      genai_confidence: body.answer.genaiConfidence,
      grammar_quality: body.answer.grammarQuality,
      prose_fluency: body.answer.proseFluency,
      personalization_level: body.answer.personalizationLevel,
      contextual_coherence: body.answer.contextualCoherence,
      difficulty: body.answer.difficulty,
      type: body.answer.type,
      user_answer: body.answer.userAnswer,
      correct: body.answer.correct,
      confidence: body.answer.confidence,
      time_from_render_ms: body.answer.timeFromRenderMs,
      time_from_confidence_ms: body.answer.timeFromConfidenceMs,
      confidence_selection_time_ms: body.answer.confidenceSelectionTimeMs,
      scroll_depth_pct: body.answer.scrollDepthPct,
      answer_method: body.answer.answerMethod,
      answer_ordinal: body.answer.answerOrdinal,
      streak_at_answer_time: body.answer.streakAtAnswerTime,
      correct_count_at_time: body.answer.correctCountAtTime,
      game_mode: body.answer.gameMode,
      is_daily_challenge: body.answer.isDailyChallenge,
      dataset_version: body.answer.datasetVersion,
    });

    if (answerError) console.error('Answer insert failed:', answerError);

    // Upsert session — runs independently regardless of answer insert result
    const { error: sessionError } = await supabase.from('sessions').upsert({
      session_id: body.session.sessionId,
      game_mode: body.session.gameMode,
      is_daily_challenge: body.session.isDailyChallenge,
      started_at: body.session.startedAt,
      completed_at: body.session.completedAt,
      cards_answered: body.session.cardsAnswered,
      final_score: body.session.finalScore,
      final_rank: body.session.finalRank,
      device_type: body.session.deviceType,
      viewport_width: body.session.viewportWidth,
      viewport_height: body.session.viewportHeight,
      referrer: body.session.referrer,
    }, { onConflict: 'session_id' });

    if (sessionError) console.error('Session upsert failed:', sessionError);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Silently fail — never break the game over analytics
    console.error('Answer logging failed:', err);
    return NextResponse.json({ ok: true });
  }
}
