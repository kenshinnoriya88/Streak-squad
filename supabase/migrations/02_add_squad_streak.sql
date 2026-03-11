-- ============================================================
-- Migration: 02_add_squad_streak
-- Description: squads テーブルにチーム連続記録カラムを追加
-- ============================================================

ALTER TABLE squads
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0;
