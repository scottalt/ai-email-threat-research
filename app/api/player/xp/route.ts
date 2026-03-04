import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { getLevelFromXp, RESEARCH_GRADUATION_SESSIONS } from '@/lib/xp';

async function getAuthId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// PATCH /api/player/xp
// Body: { xpEarned: number; score: number; gameMode: string; sessionCompleted: boolean; sessionId: string }
export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const gameMode = String(body.gameMode ?? 'freeplay');
  // Cap XP at the server-side maximum for the given mode (expert = 300, others = 150)
  const maxXp = gameMode === 'expert' ? 300 : 150;
  const xpEarned = Math.max(0, Math.min(maxXp, Number(body.xpEarned) || 0));
  const score = Math.max(0, Math.min(3500, Number(body.score) || 0));
  const sessionCompleted = Boolean(body.sessionCompleted);
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : null;

  const admin = getSupabaseAdminClient();
  const { data: player, error: fetchErr } = await admin
    .from('players')
    .select('id, xp, level, total_sessions, research_sessions_completed, research_graduated, personal_best_score, last_xp_session_id')
    .eq('auth_id', authId)
    .single();

  if (fetchErr || !player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const p = player as Record<string, unknown>;

  const newXp = (p.xp as number) + xpEarned;
  const newLevel = getLevelFromXp(newXp);
  const levelUp = newLevel > (p.level as number);
  const newTotalSessions = sessionCompleted ? (p.total_sessions as number) + 1 : p.total_sessions as number;

  // Research graduation: verify server-side that this session actually has research answers
  let isResearchSession = gameMode === 'research' && sessionCompleted && !!sessionId;
  if (isResearchSession) {
    const { count } = await admin
      .from('answers')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId!)
      .eq('game_mode', 'research');
    if (!count || count === 0) isResearchSession = false;
  }

  const newResearchSessions = isResearchSession
    ? (p.research_sessions_completed as number) + 1
    : p.research_sessions_completed as number;
  const wasGraduated = p.research_graduated as boolean;
  const nowGraduated = wasGraduated || newResearchSessions >= RESEARCH_GRADUATION_SESSIONS;

  const newBest = Math.max(p.personal_best_score as number, score);

  // Atomic dedup: the WHERE clause makes the check + write a single DB operation.
  // If sessionId was already awarded, the condition fails and 0 rows are updated.
  const updateQuery = admin.from('players').update({
    xp: newXp,
    level: newLevel,
    total_sessions: newTotalSessions,
    research_sessions_completed: newResearchSessions,
    research_graduated: nowGraduated,
    personal_best_score: newBest,
    ...(sessionId ? { last_xp_session_id: sessionId } : {}),
    updated_at: new Date().toISOString(),
  }).eq('auth_id', authId).select('id');

  // Only apply the sessionId dedup guard when a sessionId is provided
  const finalQuery = sessionId
    ? updateQuery.or(`last_xp_session_id.is.null,last_xp_session_id.neq.${sessionId}`)
    : updateQuery;

  const { data: updated, error: updateErr } = await finalQuery;
  if (updateErr) return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'XP already awarded for this session' }, { status: 409 });
  }

  return NextResponse.json({
    xp: newXp,
    level: newLevel,
    xpEarned,
    levelUp,
    graduated: !wasGraduated && nowGraduated,
    researchSessionsCompleted: newResearchSessions,
  });
}
