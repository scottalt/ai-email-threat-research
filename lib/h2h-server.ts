// ── Server-only H2H helpers (shared between match routes) ──

import { getSupabaseAdminClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import {
  H2H_CARDS_PER_MATCH,
  H2H_AFK_TIMEOUT_MS,
  CURRENT_SEASON,
  getRankFromPoints,
  calculatePointsDelta,
} from '@/lib/h2h';
import { XP_PER_CORRECT, getLevelFromXp } from '@/lib/xp';

// ── Award XP to a player for an H2H match ──

const H2H_WIN_BONUS_XP = 20;
const H2H_COMPLETION_BONUS_XP = 25;
const H2H_PERFECT_BONUS_XP = 50;

export async function awardH2HXp(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  playerId: string,
  correctCount: number,
  isWinner: boolean,
) {
  let xpEarned = correctCount * XP_PER_CORRECT;
  if (correctCount >= H2H_CARDS_PER_MATCH) {
    xpEarned += (correctCount === H2H_CARDS_PER_MATCH) ? H2H_PERFECT_BONUS_XP : H2H_COMPLETION_BONUS_XP;
  }
  if (isWinner) xpEarned += H2H_WIN_BONUS_XP;

  if (xpEarned <= 0) return;

  // Atomic read-modify-write with optimistic concurrency (retry once on conflict)
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: player } = await admin
      .from('players')
      .select('xp, level')
      .eq('id', playerId)
      .single();

    if (!player) return;

    const currentXp = player.xp as number;
    const newXp = currentXp + xpEarned;
    const newLevel = getLevelFromXp(newXp);

    const { data: updated } = await admin.from('players').update({
      xp: newXp,
      level: newLevel,
      updated_at: new Date().toISOString(),
    }).eq('id', playerId).eq('xp', currentXp).select('id');

    if (updated && updated.length > 0) return; // success
  }
  console.error(`[awardH2HXp] Failed to award ${xpEarned} XP to player ${playerId} after 2 attempts (concurrent update conflict)`);
}

// ── Finalize a completed match ──

export async function finalizeMatch(
  matchId: string,
  winnerId: string,
  loserId: string,
) {
  const admin = getSupabaseAdminClient();

  const { data: match } = await admin
    .from('h2h_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!match) {
    console.error(`[finalizeMatch] Match not found: ${matchId}`);
    return;
  }

  if (match.is_rated && match.player1_id && match.player2_id) {
    const { data: winnerStats } = await admin
      .from('h2h_player_stats')
      .select('*')
      .eq('player_id', winnerId)
      .eq('season', CURRENT_SEASON)
      .single();

    const { data: loserStats } = await admin
      .from('h2h_player_stats')
      .select('*')
      .eq('player_id', loserId)
      .eq('season', CURRENT_SEASON)
      .single();

    const winnerPoints = winnerStats?.rank_points ?? 0;
    const loserPoints = loserStats?.rank_points ?? 0;
    const winnerRank = getRankFromPoints(winnerPoints);
    const loserRank = getRankFromPoints(loserPoints);

    const today = new Date().toISOString().slice(0, 10);

    const winnerRatedToday =
      winnerStats?.last_match_date === today
        ? winnerStats.rated_matches_today ?? 0
        : 0;
    const loserRatedToday =
      loserStats?.last_match_date === today
        ? loserStats.rated_matches_today ?? 0
        : 0;

    const winnerDelta = calculatePointsDelta(
      winnerRank.tier, loserRank.tier, true, winnerRatedToday,
    );
    const loserDelta = calculatePointsDelta(
      winnerRank.tier, loserRank.tier, false, loserRatedToday,
    );

    // Atomically mark match complete — only if still active
    const { data: updated } = await admin
      .from('h2h_matches')
      .update({
        status: 'complete',
        winner_id: winnerId,
        player1_points_delta:
          winnerId === match.player1_id ? winnerDelta : loserDelta,
        player2_points_delta:
          winnerId === match.player2_id ? winnerDelta : loserDelta,
        ended_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('status', 'active')
      .select('id');

    if (!updated || updated.length === 0) {
      console.warn(`[finalizeMatch] Match ${matchId} already finalized by another thread`);
      return;
    }

    // Atomic stats update via Postgres RPC
    const [{ error: winnerRpcErr }, { error: loserRpcErr }] = await Promise.all([
      admin.rpc('update_h2h_stats', {
        p_player_id: winnerId, p_season: CURRENT_SEASON,
        p_points_delta: winnerDelta, p_is_winner: true, p_today: today,
      }),
      admin.rpc('update_h2h_stats', {
        p_player_id: loserId, p_season: CURRENT_SEASON,
        p_points_delta: loserDelta, p_is_winner: false, p_today: today,
      }),
    ]);
    if (winnerRpcErr) console.error(`[finalizeMatch] Winner stats RPC failed for ${winnerId}:`, winnerRpcErr.message);
    if (loserRpcErr) console.error(`[finalizeMatch] Loser stats RPC failed for ${loserId}:`, loserRpcErr.message);

    // Award XP
    const [{ count: winnerCorrect }, { count: loserCorrect }] = await Promise.all([
      admin.from('h2h_match_answers').select('id', { count: 'exact', head: true })
        .eq('match_id', matchId).eq('player_id', winnerId).eq('correct', true),
      admin.from('h2h_match_answers').select('id', { count: 'exact', head: true })
        .eq('match_id', matchId).eq('player_id', loserId).eq('correct', true),
    ]);

    const xpAwards: Promise<void>[] = [];
    if (winnerRatedToday < 20) xpAwards.push(awardH2HXp(admin, winnerId, winnerCorrect ?? 0, true));
    if (loserRatedToday < 20) xpAwards.push(awardH2HXp(admin, loserId, loserCorrect ?? 0, false));
    await Promise.all(xpAwards);

    if (match.is_ghost_match && match.player1_id) {
      await redis.del(`h2h:bot-lock:${match.player1_id}`);
    }

    if ((winnerCorrect ?? 0) >= H2H_CARDS_PER_MATCH) {
      await admin.from('player_achievements').upsert(
        { player_id: winnerId, achievement_id: 'h2h_perfect', unlocked_at: new Date().toISOString() },
        { onConflict: 'player_id,achievement_id' },
      );
    }
  } else {
    // Unrated / bot match
    const { data: updated } = await admin
      .from('h2h_matches')
      .update({
        status: 'complete',
        winner_id: winnerId,
        ended_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('status', 'active')
      .select('id');

    if (!updated || updated.length === 0) {
      console.warn(`[finalizeMatch] Unrated match ${matchId} already finalized by another thread`);
      return;
    }

    if (match.is_ghost_match && match.player1_id) {
      await redis.del(`h2h:bot-lock:${match.player1_id}`);
    }
  }
}

// ── Check if players are AFK in an active match ──

export interface AfkCheckResult {
  player1Afk: boolean;
  player2Afk: boolean;
}

export async function checkMatchAfk(
  matchId: string,
  player1Id: string,
  player2Id: string | null,
  player1CardsCompleted: number,
  player2CardsCompleted: number,
): Promise<AfkCheckResult> {
  const now = Date.now();
  const result: AfkCheckResult = { player1Afk: false, player2Afk: false };

  // Check player 1
  if (player1CardsCompleted < H2H_CARDS_PER_MATCH) {
    const renderTs = await redis.get<number>(`match-render:${matchId}:${player1Id}:${player1CardsCompleted}`);
    if (renderTs && (now - renderTs) > H2H_AFK_TIMEOUT_MS) {
      result.player1Afk = true;
    }
  }

  // Check player 2 (skip for bot matches)
  if (player2Id && player2CardsCompleted < H2H_CARDS_PER_MATCH) {
    const renderTs = await redis.get<number>(`match-render:${matchId}:${player2Id}:${player2CardsCompleted}`);
    if (renderTs && (now - renderTs) > H2H_AFK_TIMEOUT_MS) {
      result.player2Afk = true;
    }
  }

  return result;
}
