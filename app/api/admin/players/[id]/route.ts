import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { getLevelFromXp } from '@/lib/xp';
import { CURRENT_SEASON, getRankFromPoints } from '@/lib/h2h';

// GET /api/admin/players/[id] — full player detail
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const admin = getSupabaseAdminClient();

  const { data: player, error } = await admin
    .from('players')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const [
    { count: totalAnswers },
    { count: correctAnswers },
    { count: researchAnswers },
    { data: achievements },
    { data: h2hStats },
    { data: streaks },
    { count: friendCount },
  ] = await Promise.all([
    admin.from('answers').select('id', { count: 'exact', head: true }).eq('player_id', id),
    admin.from('answers').select('id', { count: 'exact', head: true }).eq('player_id', id).eq('correct', true),
    admin.from('answers').select('id', { count: 'exact', head: true }).eq('player_id', id).eq('game_mode', 'research'),
    admin.from('player_achievements').select('achievement_id, unlocked_at').eq('player_id', id),
    admin.from('h2h_player_stats').select('*').eq('player_id', id).eq('season', CURRENT_SEASON).maybeSingle(),
    admin.from('player_streaks').select('current_streak, longest_streak').eq('player_id', id).maybeSingle(),
    admin.from('player_friends').select('id', { count: 'exact', head: true })
      .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
      .eq('status', 'accepted'),
  ]);

  const h2hRank = h2hStats ? getRankFromPoints(h2hStats.rank_points ?? 0) : null;

  return NextResponse.json({
    player,
    stats: {
      totalAnswers: totalAnswers ?? 0,
      correctAnswers: correctAnswers ?? 0,
      accuracy: totalAnswers ? Math.round(((correctAnswers ?? 0) / totalAnswers) * 100) : 0,
      researchAnswers: researchAnswers ?? 0,
      currentStreak: streaks?.current_streak ?? 0,
      longestStreak: streaks?.longest_streak ?? 0,
      friendCount: friendCount ?? 0,
    },
    achievements: (achievements ?? []).map((a: { achievement_id: string; unlocked_at: string }) => ({
      id: a.achievement_id,
      unlockedAt: a.unlocked_at,
    })),
    h2h: h2hStats ? {
      rankPoints: h2hStats.rank_points,
      rankLabel: h2hRank?.label ?? 'BRONZE',
      rankColor: h2hRank?.color ?? '#8B4513',
      wins: h2hStats.wins,
      losses: h2hStats.losses,
      winStreak: h2hStats.win_streak,
      bestWinStreak: h2hStats.best_win_streak,
      peakRankPoints: h2hStats.peak_rank_points,
    } : null,
  });
}

// PATCH /api/admin/players/[id] — modify any player's stats
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.xp === 'number' && body.xp >= 0) updates.xp = body.xp;
  if (typeof body.level === 'number' && body.level >= 1 && body.level <= 30) updates.level = body.level;
  if (typeof body.displayName === 'string' && body.displayName.trim().length > 0) updates.display_name = body.displayName.trim().slice(0, 20);
  if (typeof body.bio === 'string') updates.bio = body.bio.slice(0, 200);
  if (typeof body.researchGraduated === 'boolean') updates.research_graduated = body.researchGraduated;
  if (typeof body.totalSessions === 'number' && body.totalSessions >= 0) updates.total_sessions = body.totalSessions;
  if (typeof body.researchSessionsCompleted === 'number' && body.researchSessionsCompleted >= 0) {
    updates.research_sessions_completed = body.researchSessionsCompleted;
  }

  if (body.reset === true) {
    const admin = getSupabaseAdminClient();
    const xp = 'xp' in updates
      ? (updates.xp as number)
      : ((await admin.from('players').select('xp').eq('id', id).single()).data?.xp ?? 0);
    updates.level = getLevelFromXp(xp as number);
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('players')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  return NextResponse.json({ ok: true, player: data });
}
