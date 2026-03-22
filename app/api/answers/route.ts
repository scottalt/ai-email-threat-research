import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
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
    if (data?.id) return data.id;
    // Player record doesn't exist yet — create it so answers aren't silently lost
    await admin.from('players').upsert({ auth_id: user.id }, { onConflict: 'auth_id', ignoreDuplicates: true });
    const { data: created } = await admin.from('players').select('id').eq('auth_id', user.id).single();
    return created?.id ?? null;
  } catch {
    return null;
  }
}

const VALID_ANSWERS = ['phishing', 'legit'] as const;
const VALID_CONFIDENCES = ['guessing', 'likely', 'certain'] as const;
const VALID_MODES = ['research', 'freeplay', 'daily', 'preview', 'expert'] as const;
const MAX_ANSWERS_PER_SESSION = 10; // universal cap — no session should have more than 10 answers
const MAX_RESEARCH_ANSWERS = 10;
const MAX_RESEARCH_ANSWERS_PER_PLAYER_TOTAL = 30; // 3 full rounds max
const MAX_RESEARCH_ANSWERS_PER_PLAYER_PER_DAY = 50; // 5 sessions max per day

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
      console.warn('[answers] reject: validation failed', { ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() });
      return NextResponse.json({ ok: true }); // silent reject — don't break the game
    }

    // Preview mode — never write to DB
    if (a.gameMode === 'preview') {
      return NextResponse.json({ ok: true });
    }

    // Rate limit: 30 answer submissions per IP per minute (across all modes)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const answerRlKey = `ratelimit:answers:${ip}`;
    const answerRlCount = await redis.incr(answerRlKey);
    if (answerRlCount === 1) await redis.expire(answerRlKey, 60);
    if (answerRlCount > 30) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Research and expert modes require authentication — silently skip unauthenticated answers
    const playerId = await getPlayerId();
    if ((a.gameMode === 'research' || a.gameMode === 'expert') && !playerId) {
      console.warn('[answers] reject: unauthenticated research/expert', { mode: a.gameMode, ip });
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdminClient();

    // Universal per-session answer cap — prevents inflating answer counts for XP manipulation
    {
      const { count: sessionAnswerCount } = await supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', a.sessionId);

      if ((sessionAnswerCount ?? 0) >= MAX_ANSWERS_PER_SESSION) {
        console.warn('[answers] reject: session full', { sessionId: a.sessionId, count: sessionAnswerCount });
        return NextResponse.json({ ok: true }); // silent reject — session full
      }
    }

    // Server-side verification of correct answer for all modes
    let verifiedCorrect = a.correct;
    let verifiedIsPhishing = a.isPhishing;
    let verifiedTechnique = a.technique;

    // For all modes: cross-check against Redis session card store (same store /api/cards/check uses)
    if (a.gameMode !== 'research') {
      const cardsJson = await redis.get<string>(`session-cards:${a.sessionId}`);
      if (!cardsJson) {
        // Redis key expired — reject rather than trusting client values
        console.warn('[answers] reject: session expired in Redis', { sessionId: a.sessionId, mode: a.gameMode });
        return NextResponse.json({ ok: true }); // silent reject
      }
      const cards = typeof cardsJson === 'string' ? JSON.parse(cardsJson) : cardsJson;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const card = cards.find((c: any) => c.id === a.cardId);
      if (!card) {
        console.warn('[answers] reject: card not in session', { sessionId: a.sessionId, cardId: a.cardId });
        return NextResponse.json({ ok: true }); // silent reject — card not in session
      }
      verifiedIsPhishing = card.isPhishing;
      verifiedCorrect = (a.userAnswer === 'phishing') === card.isPhishing;
      verifiedTechnique = card.technique ?? a.technique;
    }

    if (a.gameMode === 'research') {
      // 1. Card must exist in cards_real — reject fabricated card IDs
      const { data: card } = await supabase
        .from('cards_real')
        .select('is_phishing, technique')
        .eq('card_id', a.cardId)
        .single();

      if (!card) {
        console.warn('[answers] reject: research card not in cards_real', { cardId: a.cardId });
        return NextResponse.json({ ok: true }); // silent reject — card doesn't exist
      }

      // 1b. Validate card was actually dealt to this session (if session has dealt_card_ids)
      const { data: session } = await supabase
        .from('sessions')
        .select('dealt_card_ids')
        .eq('session_id', a.sessionId)
        .single();

      if (session?.dealt_card_ids && !session.dealt_card_ids.includes(a.cardId)) {
        console.warn('[answers] reject: card not dealt to session', { sessionId: a.sessionId, cardId: a.cardId });
        return NextResponse.json({ ok: true }); // silent reject — card not dealt to this session
      }

      // 2. Session dedup: reject if session already has MAX_RESEARCH_ANSWERS research answers
      const { count: sessionCount } = await supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', a.sessionId)
        .eq('game_mode', 'research');

      if ((sessionCount ?? 0) >= MAX_RESEARCH_ANSWERS) {
        console.warn('[answers] reject: research session cap', { sessionId: a.sessionId, count: sessionCount });
        return NextResponse.json({ ok: true }); // silent reject
      }

      // 3. Per-player card dedup: reject if this player already answered this card
      if (playerId) {
        const { count: dupCount } = await supabase
          .from('answers')
          .select('id', { count: 'exact', head: true })
          .eq('player_id', playerId)
          .eq('card_id', a.cardId)
          .eq('game_mode', 'research');

        if ((dupCount ?? 0) > 0) {
          console.warn('[answers] reject: duplicate research answer', { playerId, cardId: a.cardId });
          return NextResponse.json({ ok: true }); // silent reject — already answered
        }
      }

      // 4. Per-player total research cap: no more than 30 research answers ever
      if (playerId) {
        const { count: totalResearchCount } = await supabase
          .from('answers')
          .select('id', { count: 'exact', head: true })
          .eq('player_id', playerId)
          .eq('game_mode', 'research');

        if ((totalResearchCount ?? 0) >= MAX_RESEARCH_ANSWERS_PER_PLAYER_TOTAL) {
          console.warn('[answers] reject: lifetime research cap', { playerId, count: totalResearchCount });
          return NextResponse.json({ ok: true }); // silent reject — lifetime cap
        }
      }

      // 5. Per-player daily rate limit: use Redis counter to avoid O(n) DB scan each submission
      if (playerId) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const dailyKey = `ratelimit:research:${playerId}:${todayStr}`;
        const dailyCount = await redis.get<number>(dailyKey);

        if ((dailyCount ?? 0) >= MAX_RESEARCH_ANSWERS_PER_PLAYER_PER_DAY) {
          console.warn('[answers] reject: daily research limit', { playerId, count: dailyCount });
          return NextResponse.json({ ok: true }); // silent reject — daily limit
        }
      }

      // Server-side verification of correct answer and technique
      verifiedIsPhishing = card.is_phishing;
      verifiedTechnique = card.technique;
      verifiedCorrect = (a.userAnswer === 'phishing') === card.is_phishing;
    }

    // Server-side streak — read from Redis (written by /api/cards/check for all modes)
    const streakKey = `session-streak:${a.sessionId}`;
    const serverStreak = (await redis.get<number>(streakKey)) ?? 0;

    const { count: serverCorrectCount } = await supabase
      .from('answers')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', a.sessionId)
      .eq('correct', true);

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
      scroll_depth_pct: Math.min(100, Math.max(0, a.scrollDepthPct ?? 0)),
      answer_method: a.answerMethod,
      answer_ordinal: a.answerOrdinal,
      streak_at_answer_time: serverStreak,
      correct_count_at_time: serverCorrectCount ?? 0,
      game_mode: a.gameMode,
      is_daily_challenge: a.isDailyChallenge,
      dataset_version: a.datasetVersion,
      headers_opened: a.headersOpened,
      url_inspected: a.urlInspected,
      auth_status: a.authStatusSignal,
      has_reply_to: a.hasReplyTo,
      has_url: a.hasUrl,
      has_attachment: a.hasAttachment,
      auth_visible: false,
      // has_sent_at: a.hasSentAt, — column not yet in schema
    });

    if (answerError) {
      // Unique constraint violation = duplicate research answer (race condition caught by DB)
      if (answerError.code === '23505') {
        console.warn('[answers] reject: DB unique constraint (race condition)', { cardId: a.cardId });
        return NextResponse.json({ ok: true }); // silent reject — duplicate
      }
      console.error('Answer insert failed:', answerError);
      return NextResponse.json({ ok: false, error: 'answer_insert_failed' }, { status: 500 });
    }

    // Increment Redis daily counter after successful insert (research mode only)
    if (a.gameMode === 'research' && playerId) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const dailyKey = `ratelimit:research:${playerId}:${todayStr}`;
      const newCount = await redis.incr(dailyKey);
      if (newCount === 1) await redis.expire(dailyKey, 24 * 60 * 60);
    }

    // Upsert session only after answer insert succeeds
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

    if (sessionError) {
      console.error('Session upsert failed:', sessionError);
      // Answer was saved, so return ok but log the session error
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Answer logging failed:', err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
