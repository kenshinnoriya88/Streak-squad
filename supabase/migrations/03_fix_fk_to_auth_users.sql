-- ============================================================
-- Migration: 03_fix_fk_to_auth_users
-- Description: squad_members / challenges の user_id FK を
--              profiles(id) から auth.users(id) に変更する。
--              profiles レコードが存在しなくてもエラーが出なくなる。
-- ============================================================

-- ── squad_members ──
ALTER TABLE squad_members
  DROP CONSTRAINT IF EXISTS squad_members_user_id_fkey;

ALTER TABLE squad_members
  ADD CONSTRAINT squad_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── challenges ──
ALTER TABLE challenges
  DROP CONSTRAINT IF EXISTS challenges_user_id_fkey;

ALTER TABLE challenges
  ADD CONSTRAINT challenges_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 既存ユーザーの profiles レコードを補完するトリガー ──
-- (新規サインアップ時に profiles が自動作成されていない場合の対策)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
