-- ============================================================
-- Migration: 01_add_billing_tables
-- Description: ペナルティ型マネタイズ（デポジット没収）対応
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles テーブルに stripe_customer_id を追加
-- ------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;


-- ------------------------------------------------------------
-- 2. challenges テーブルの新規作成
--    ユーザーの目標とデポジットを管理する
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS challenges (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  squad_id                uuid          REFERENCES squads(id) ON DELETE SET NULL,
  task_description        text          NOT NULL,
  deposit_amount          integer       NOT NULL,
  status                  text          NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'failed', 'escaped')),
  stripe_payment_intent_id text,
  created_at              timestamptz   NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- 3. transactions テーブルの新規作成
--    没収・課金の売上履歴用
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount            integer     NOT NULL,
  transaction_type  text        NOT NULL
                      CHECK (transaction_type IN ('penalty', 'escape_ticket', 'redemption')),
  stripe_charge_id  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- 4. Row Level Security (RLS) の設定
--    MVP用: すべてのテーブルで全操作を許可
-- ------------------------------------------------------------

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_profiles" ON profiles;
CREATE POLICY "allow_all_profiles" ON profiles
  FOR ALL USING (true) WITH CHECK (true);

-- challenges
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_challenges" ON challenges;
CREATE POLICY "allow_all_challenges" ON challenges
  FOR ALL USING (true) WITH CHECK (true);

-- transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_transactions" ON transactions;
CREATE POLICY "allow_all_transactions" ON transactions
  FOR ALL USING (true) WITH CHECK (true);
