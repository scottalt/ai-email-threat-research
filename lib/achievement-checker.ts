import { ACHIEVEMENTS } from './achievements';
import type { SupabaseClient } from '@supabase/supabase-js';

interface PlayerStats {
  id: string;
  xp: number;
  level: number;
  totalSessions: number;
  researchGraduated: boolean;
  personalBestScore: number;
  researchAnswersSubmitted?: number;
  h2hWins?: number;
  h2hBestStreak?: number;
  h2hPeakRankPoints?: number;
}

interface AnswerRow {
  correct: boolean;
  confidence: string;
  difficulty: string;
  time_from_render_ms: number | null;
  streak_at_answer_time: number;
  headers_opened: boolean;
  url_inspected: boolean;
  game_mode: string;
}

type CheckFn = (
  player: PlayerStats,
  answers: AnswerRow[],
  gameMode: string,
  extra: { dailySessionCount: number; currentStreak?: number },
) => boolean;

const CHECKS: Record<string, CheckFn> = {
  // Progression
  first_blood:     (p) => p.totalSessions >= 1,
  veteran:         (p) => p.totalSessions >= 10,
  graduate:        (p) => p.researchGraduated,
  apex:            (p) => p.level >= 30,

  // Skill
  perfect_round:   (_p, a) => a.length >= 10 && a.filter(r => r.correct).length === a.length,
  certain_correct: (_p, a) => a.filter(r => r.correct && r.confidence === 'certain').length >= 5,
  hard_sweep:      (_p, a) => a.length >= 10 && a.every(r => ['hard', 'extreme'].includes(r.difficulty) && r.correct),
  expert_ace:      (_p, a, gm) => gm === 'expert' && a.length >= 10 && a.filter(r => r.correct).length === a.length,

  // Streak
  streak_5:        (_p, a) => a.some(r => r.streak_at_answer_time >= 5),
  streak_10:       (_p, a) => a.some(r => r.streak_at_answer_time >= 10),
  daily_3:         (_p, _a, _gm, extra) => extra.dailySessionCount >= 3,

  // Daily streak
  streak_3d:       (_p, _a, _gm, extra) => (extra.currentStreak ?? 0) >= 3,
  streak_7d:       (_p, _a, _gm, extra) => (extra.currentStreak ?? 0) >= 7,
  streak_30d:      (_p, _a, _gm, extra) => (extra.currentStreak ?? 0) >= 30,

  // Speed
  speed_demon:     (_p, a) => a.some(r => r.correct && r.confidence === 'certain' && r.time_from_render_ms !== null && r.time_from_render_ms < 5000),
  methodical:      (_p, a) => {
    const withTime = a.filter(r => r.time_from_render_ms !== null);
    if (withTime.length < 8) return false;
    const avg = withTime.reduce((s, r) => s + (r.time_from_render_ms ?? 0), 0) / withTime.length;
    return avg > 30000 && a.filter(r => r.correct).length >= 8;
  },

  // Investigation
  header_hunter:   (_p, a) => a.filter(r => r.headers_opened).length >= 5,
  url_inspector:   (_p, a) => a.filter(r => r.url_inspected).length >= 5,
  full_recon:      (_p, a) => a.filter(r => r.headers_opened && r.url_inspected).length >= 3,

  // XP
  xp_1000:         (p) => p.xp >= 1000,
  xp_5000:         (p) => p.xp >= 5000,
  xp_20000:        (p) => p.xp >= 20000,
  pb_2500:         (p) => p.personalBestScore >= 2500,

  // Research milestones
  research_20:     (p) => (p.researchAnswersSubmitted ?? 0) >= 20,
  research_30:     (p) => (p.researchAnswersSubmitted ?? 0) >= 30,

  // H2H
  h2h_first_win:   (p) => (p.h2hWins ?? 0) >= 1,
  h2h_10_wins:     (p) => (p.h2hWins ?? 0) >= 10,
  h2h_50_wins:     (p) => (p.h2hWins ?? 0) >= 50,
  h2h_perfect:     () => false, // checked inline during match finalization
  h2h_streak_5:    (p) => (p.h2hBestStreak ?? 0) >= 5,

  // Season 0
  founder:         (p) => p.totalSessions >= 1, // any player who played during Season 0
  s0_silver:       (p) => (p.h2hPeakRankPoints ?? 0) >= 100,
  s0_gold:         (p) => (p.h2hPeakRankPoints ?? 0) >= 250,
  s0_platinum:     (p) => (p.h2hPeakRankPoints ?? 0) >= 450,
  s0_diamond:      (p) => (p.h2hPeakRankPoints ?? 0) >= 700,
  s0_master:       (p) => (p.h2hPeakRankPoints ?? 0) >= 1000,
  s0_elite:        (p) => (p.h2hPeakRankPoints ?? 0) >= 1400,
};

/**
 * Check and award any newly earned achievements for a player after a session.
 * Returns array of newly unlocked achievement IDs.
 */
export async function checkAchievements(
  admin: SupabaseClient,
  player: PlayerStats,
  sessionId: string,
  sessionAnswers: AnswerRow[],
  gameMode: string,
  currentStreak: number = 0,
): Promise<string[]> {
  // 1. Fetch already-unlocked achievement IDs
  const { data: existing } = await admin
    .from('player_achievements')
    .select('achievement_id')
    .eq('player_id', player.id);

  const earned = new Set((existing ?? []).map((r: { achievement_id: string }) => r.achievement_id));

  // 2. Find unearned achievements
  const unearned = ACHIEVEMENTS.filter(a => !earned.has(a.id));
  if (unearned.length === 0) return [];

  // 3. Fetch extra data only if needed (daily session count)
  let dailySessionCount = 0;
  if (unearned.some(a => a.id === 'daily_3')) {
    const { count } = await admin
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('game_mode', 'daily')
      .not('completed_at', 'is', null)
      .eq('player_id', player.id);
    dailySessionCount = count ?? 0;
  }

  // 4. Evaluate each unearned achievement
  const newlyEarned: string[] = [];
  for (const achievement of unearned) {
    const check = CHECKS[achievement.id];
    if (!check) continue;
    if (check(player, sessionAnswers, gameMode, { dailySessionCount, currentStreak })) {
      newlyEarned.push(achievement.id);
    }
  }

  // 5. Batch insert newly earned achievements
  if (newlyEarned.length > 0) {
    await admin.from('player_achievements').insert(
      newlyEarned.map(id => ({
        player_id: player.id,
        achievement_id: id,
        session_id: sessionId,
      }))
    );
  }

  return newlyEarned;
}

/**
 * Backfill achievements for a single player based on their cumulative stats
 * and all historical session answers. Used for retroactive awards.
 */
export async function backfillPlayerAchievements(
  admin: SupabaseClient,
  player: PlayerStats,
): Promise<string[]> {
  // Fetch already-unlocked
  const { data: existing } = await admin
    .from('player_achievements')
    .select('achievement_id')
    .eq('player_id', player.id);

  const earned = new Set((existing ?? []).map((r: { achievement_id: string }) => r.achievement_id));
  const unearned = ACHIEVEMENTS.filter(a => !earned.has(a.id));
  if (unearned.length === 0) return [];

  // Fetch all sessions for this player to check per-session achievements
  const { data: sessions } = await admin
    .from('sessions')
    .select('session_id, game_mode, completed_at')
    .eq('player_id', player.id)
    .not('completed_at', 'is', null);

  // Daily session count
  const dailySessionCount = (sessions ?? []).filter((s: { game_mode: string }) => s.game_mode === 'daily').length;

  // Check profile-based achievements first (no per-session data needed)
  const profileChecks = ['first_blood', 'veteran', 'graduate', 'apex', 'xp_1000', 'xp_5000', 'xp_20000', 'pb_2500', 'daily_3'];
  const newlyEarned: string[] = [];

  for (const id of profileChecks) {
    if (earned.has(id)) continue;
    const check = CHECKS[id];
    if (!check) continue;
    if (check(player, [], '', { dailySessionCount })) {
      newlyEarned.push(id);
    }
  }

  // Check per-session achievements across all historical sessions
  const sessionAchievements = ['perfect_round', 'certain_correct', 'hard_sweep', 'expert_ace',
    'streak_5', 'streak_10', 'speed_demon', 'methodical',
    'header_hunter', 'url_inspector', 'full_recon'];
  const unearnedSessionIds = sessionAchievements.filter(id => !earned.has(id) && !newlyEarned.includes(id));

  if (unearnedSessionIds.length > 0 && sessions && sessions.length > 0) {
    for (const sess of sessions) {
      const s = sess as { session_id: string; game_mode: string };
      if (unearnedSessionIds.every(id => newlyEarned.includes(id))) break;

      const { data: answers } = await admin
        .from('answers')
        .select('correct, confidence, difficulty, time_from_render_ms, streak_at_answer_time, headers_opened, url_inspected, game_mode')
        .eq('session_id', s.session_id);

      if (!answers || answers.length === 0) continue;

      for (const id of unearnedSessionIds) {
        if (newlyEarned.includes(id)) continue;
        const check = CHECKS[id];
        if (!check) continue;
        if (check(player, answers as AnswerRow[], s.game_mode, { dailySessionCount })) {
          newlyEarned.push(id);
        }
      }
    }
  }

  // Batch insert
  if (newlyEarned.length > 0) {
    await admin.from('player_achievements').insert(
      newlyEarned.map(id => ({
        player_id: player.id,
        achievement_id: id,
      }))
    );
  }

  return newlyEarned;
}
