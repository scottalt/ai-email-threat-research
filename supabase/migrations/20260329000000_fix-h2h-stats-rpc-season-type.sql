-- Fix: p_season was declared as integer but h2h_player_stats.season is TEXT.
-- This caused the update_h2h_stats RPC to fail on type mismatch,
-- preventing rank points from being recorded after matches.

CREATE OR REPLACE FUNCTION update_h2h_stats(
  p_player_id uuid,
  p_season text,
  p_points_delta integer,
  p_is_winner boolean,
  p_today text
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO h2h_player_stats (
    player_id, season, rank_points, wins, losses,
    win_streak, best_win_streak, peak_rank_points,
    rated_matches_today, last_match_date
  ) VALUES (
    p_player_id, p_season,
    GREATEST(0, p_points_delta),
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    CASE WHEN p_is_winner THEN 0 ELSE 1 END,
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    GREATEST(0, p_points_delta),
    1, p_today
  )
  ON CONFLICT (player_id, season) DO UPDATE SET
    rank_points = GREATEST(0, h2h_player_stats.rank_points + p_points_delta),
    wins = h2h_player_stats.wins + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    losses = h2h_player_stats.losses + CASE WHEN p_is_winner THEN 0 ELSE 1 END,
    win_streak = CASE WHEN p_is_winner THEN h2h_player_stats.win_streak + 1 ELSE 0 END,
    best_win_streak = GREATEST(
      h2h_player_stats.best_win_streak,
      CASE WHEN p_is_winner THEN h2h_player_stats.win_streak + 1 ELSE h2h_player_stats.best_win_streak END
    ),
    peak_rank_points = GREATEST(
      h2h_player_stats.peak_rank_points,
      GREATEST(0, h2h_player_stats.rank_points + p_points_delta)
    ),
    rated_matches_today = CASE
      WHEN h2h_player_stats.last_match_date = p_today
      THEN h2h_player_stats.rated_matches_today + 1
      ELSE 1
    END,
    last_match_date = p_today;
END;
$$;
