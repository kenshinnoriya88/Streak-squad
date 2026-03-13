-- ============================================================
-- Migration: 08_add_xp_system
-- Description: XP（経験値）システム用カラムとRPC関数を追加
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;

-- XPをアトミックにインクリメントするRPC
CREATE OR REPLACE FUNCTION increment_xp(user_id_param uuid, amount_param integer)
RETURNS TABLE(new_xp integer) AS $$
  UPDATE profiles
  SET xp = xp + amount_param
  WHERE id = user_id_param
  RETURNING xp;
$$ LANGUAGE sql;
