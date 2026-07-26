-- ============================================================================
-- FUNDS MIGRATION — run once in Supabase → SQL Editor (safe to re-run).
--
-- Fixes the "undefined / ₹NaN" Funds tab: the app saves fund_name /
-- target_amount / current_amount but the original funds table only had
-- name / balance. Adds the missing columns, backfills from the old ones,
-- and creates the fund_contributions table for the "add money" history.
-- ============================================================================

-- 1. Missing columns on funds
ALTER TABLE public.funds ADD COLUMN IF NOT EXISTS fund_name TEXT;
ALTER TABLE public.funds ADD COLUMN IF NOT EXISTS target_amount NUMERIC(14,2);
ALTER TABLE public.funds ADD COLUMN IF NOT EXISTS current_amount NUMERIC(14,2);

-- 2. Backfill from the legacy columns where present
UPDATE public.funds
SET fund_name      = COALESCE(fund_name, name),
    current_amount = COALESCE(current_amount, balance)
WHERE fund_name IS NULL OR current_amount IS NULL;

-- 3. Contribution history ("₹1000 now, ₹1000 next month")
CREATE TABLE IF NOT EXISTS public.fund_contributions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fund_id TEXT,
    amount NUMERIC(14,2),
    date DATE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fund_contributions_user ON public.fund_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_contributions_fund ON public.fund_contributions(fund_id);

-- 4. Row-level security (same pattern as every other table)
ALTER TABLE public.fund_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own data select" ON public.fund_contributions;
DROP POLICY IF EXISTS "users own data insert" ON public.fund_contributions;
DROP POLICY IF EXISTS "users own data update" ON public.fund_contributions;
DROP POLICY IF EXISTS "users own data delete" ON public.fund_contributions;
CREATE POLICY "users own data select" ON public.fund_contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users own data insert" ON public.fund_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users own data update" ON public.fund_contributions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users own data delete" ON public.fund_contributions FOR DELETE USING (auth.uid() = user_id);
