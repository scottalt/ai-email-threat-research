import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { isAdminUser } from '@/lib/adminAuth';
import { getLevelFromXp } from '@/lib/xp';
import type { PlayerProfile, PlayerBackground } from '@/lib/types';

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

// PATCH /api/player/admin — admin override of player stats
// Body: { xp?, level?, researchGraduated?, totalSessions?, researchSessionsCompleted?, reset? }
// reset: true → recalculate level from XP (after applying any XP override)
export async function PATCH(req: NextRequest) {
  const authId = await getAuthId();
  if (!authId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdminUser(authId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.xp === 'number' && body.xp >= 0) updates.xp = body.xp;
  if (typeof body.level === 'number' && body.level >= 1 && body.level <= 30) updates.level = body.level;
  if (typeof body.researchGraduated === 'boolean') updates.research_graduated = body.researchGraduated;
  if (typeof body.totalSessions === 'number' && body.totalSessions >= 0) updates.total_sessions = body.totalSessions;
  if (typeof body.researchSessionsCompleted === 'number' && body.researchSessionsCompleted >= 0) {
    updates.research_sessions_completed = body.researchSessionsCompleted;
  }

  if (body.reset === true) {
    const adminClient = getSupabaseAdminClient();
    const xp = 'xp' in updates
      ? (updates.xp as number)
      : ((await adminClient.from('players').select('xp').eq('auth_id', authId).single()).data?.xp ?? 0);
    updates.level = getLevelFromXp(xp as number);
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .update(updates)
    .eq('auth_id', authId)
    .select('*')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  const row = data as Record<string, unknown>;
  const profile: PlayerProfile = {
    id: row.id as string,
    authId: row.auth_id as string,
    displayName: row.display_name as string | null,
    xp: row.xp as number,
    level: row.level as number,
    totalSessions: row.total_sessions as number,
    researchSessionsCompleted: row.research_sessions_completed as number,
    researchAnswersSubmitted: 0,
    researchGraduated: row.research_graduated as boolean,
    personalBestScore: row.personal_best_score as number,
    background: (row.background as PlayerBackground | null) ?? null,
  };
  return NextResponse.json(profile);
}
