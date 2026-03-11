-- ============================================================
-- Migration: 04_push_subscriptions
-- Description: Web Push 通知用のサブスクリプション管理テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription jsonb      NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 自分のサブスクリプションのみ登録・更新・参照可能
CREATE POLICY "Users manage own subscription"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
