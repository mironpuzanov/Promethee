-- Fix leaderboard week window (sessions are stored in epoch milliseconds)
-- and stop exposing the full user_profile table just to power leaderboard reads.

DROP VIEW IF EXISTS leaderboard_weekly;

CREATE OR REPLACE VIEW leaderboard_weekly AS
WITH week_start AS (
  SELECT (EXTRACT(EPOCH FROM DATE_TRUNC('week', NOW()))::BIGINT * 1000) AS started_at_ms
)
SELECT
  up.id,
  up.display_name,
  up.total_xp,
  COALESCE(SUM(s.xp_earned), 0)::BIGINT AS weekly_xp,
  RANK() OVER (
    ORDER BY COALESCE(SUM(s.xp_earned), 0) DESC, up.created_at ASC, up.id ASC
  ) AS rank
FROM user_profile up
LEFT JOIN sessions s
  ON s.user_id = up.id
  AND s.ended_at IS NOT NULL
  AND s.started_at >= (SELECT started_at_ms FROM week_start)
GROUP BY up.id, up.display_name, up.total_xp, up.created_at;

DROP POLICY IF EXISTS "leaderboard public read" ON user_profile;

CREATE OR REPLACE FUNCTION get_public_leaderboard_weekly(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  total_xp INTEGER,
  weekly_xp BIGINT,
  rank BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lw.id,
    lw.display_name,
    lw.total_xp,
    lw.weekly_xp,
    lw.rank
  FROM leaderboard_weekly lw
  ORDER BY lw.rank ASC, lw.id ASC
  LIMIT GREATEST(limit_count, 0);
$$;

REVOKE ALL ON FUNCTION get_public_leaderboard_weekly(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_leaderboard_weekly(INTEGER) TO anon, authenticated;
