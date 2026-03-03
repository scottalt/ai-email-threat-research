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
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// PATCH /api/player/xp
// Body: { xpEarned: number; score: number; gameMode: string; sessionCompleted: boolean }
export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const xpEarned = Math.max(0, Math.min(1000, Number(body.xpEarned) || 0));
  const score = Number(body.score) || 0;
  const gameMode = String(body.gameMode ?? 'freeplay');
  const sessionCompleted = Boolean(body.sessionCompleted);

  const admin = getSupabaseAdminClient();
  const { data: player, error: fetchErr } = await admin
    .from('players')
    .select('id, xp, level, total_sessions, research_sessions_completed, research_graduated, personal_best_score')
    .eq('auth_id', authId)
    .single();

  if (fetchErr || !player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const p = player as Record<string, unknown>;
  const newXp = (p.xp as number) + xpEarned;
  const newLevel = getLevelFromXp(newXp);
  const levelUp = newLevel > (p.level as number);
  const newTotalSessions = sessionCompleted ? (p.total_sessions as number) + 1 : p.total_sessions as number;

  const isResearchSession = gameMode === 'research' && sessionCompleted;
  const newResearchSessions = isResearchSession
    ? (p.research_sessions_completed as number) + 1
    : p.research_sessions_completed as number;
  const wasGraduated = p.research_graduated as boolean;
  const nowGraduated = wasGraduated || newResearchSessions >= RESEARCH_GRADUATION_SESSIONS;

  const newBest = Math.max(p.personal_best_score as number, score);

  await admin.from('players').update({
    xp: newXp,
    level: newLevel,
    total_sessions: newTotalSessions,
    research_sessions_completed: newResearchSessions,
    research_graduated: nowGraduated,
    personal_best_score: newBest,
    updated_at: new Date().toISOString(),
  }).eq('auth_id', authId);

  return NextResponse.json({
    xp: newXp,
    level: newLevel,
    xpEarned,
    levelUp,
    graduated: !wasGraduated && nowGraduated,  // true only on the transition
    researchSessionsCompleted: newResearchSessions,
  });
}
