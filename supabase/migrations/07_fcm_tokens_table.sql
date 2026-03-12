-- ============================================================
-- Migration: 07_fcm_tokens_table
-- Description: 複数デバイス対応のFCMトークンテーブルを作成
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_label text,              -- 識別用ラベル（任意）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

-- 既存の profiles.fcm_token からデータ移行
INSERT INTO public.fcm_tokens (user_id, token)
SELECT id, fcm_token FROM public.profiles
WHERE fcm_token IS NOT NULL
ON CONFLICT DO NOTHING;
