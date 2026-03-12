-- ============================================================
-- Migration: 06_add_squad_id_to_workouts
-- Description: workouts テーブルに squad_id を追加しデータ分離
-- ============================================================

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS squad_id uuid REFERENCES squads(id) ON DELETE SET NULL;
