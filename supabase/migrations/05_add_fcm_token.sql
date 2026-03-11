-- ============================================================
-- Migration: 05_add_fcm_token
-- Description: profiles テーブルに FCM Token カラムを追加
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fcm_token text;
