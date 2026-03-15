import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.TEST_SUPABASE_URL!;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_KEY!;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Get a player's current state from the database.
 */
export async function getPlayerState(authId: string) {
  const { data } = await admin
    .from('players')
    .select('id, xp, level, total_sessions, research_sessions_completed, research_graduated, personal_best_score, last_xp_session_id')
    .eq('auth_id', authId)
    .single();
  return data;
}

/**
 * Count answers for a player in a specific game mode.
 */
export async function countAnswers(authId: string, gameMode: string) {
  const { data: player } = await admin
    .from('players')
    .select('id')
    .eq('auth_id', authId)
    .single();
  if (!player) return 0;

  const { count } = await admin
    .from('answers')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', player.id)
    .eq('game_mode', gameMode);
  return count ?? 0;
}

/**
 * Count answers by session_id and game_mode.
 * Useful when auth session may not propagate correctly (e.g., preview deployments)
 * and answers are recorded with player_id = null.
 */
export async function countAnswersBySession(sessionId: string, gameMode: string) {
  const { count } = await admin
    .from('answers')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('game_mode', gameMode);
  return count ?? 0;
}

/**
 * Check if a session was finalized (completed_at is set).
 */
export async function getSession(sessionId: string) {
  const { data } = await admin
    .from('sessions')
    .select('session_id, completed_at, cards_answered, final_score')
    .eq('session_id', sessionId)
    .single();
  return data;
}
