-- ============================================================================
-- ASSETS MIGRATION — run once in Supabase → SQL Editor (safe to re-run).
--
-- Adds asset value history so the Assets tab can chart net-worth growth
-- month by month. Backfills one snapshot per existing asset from its
-- current value so the chart starts with data.
-- ============================================================================

-- The app saves an asset "type" (Cash / Investment / Property) — make sure the
-- column exists (older schemas dropped it silently).
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS type TEXT;

-- Expected annual return (%) per asset — powers return-aware projections.
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS expected_return NUMERIC(6,2);

-- Custom net-worth milestone for the Assets page (empty = automatic).
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS networth_milestone NUMERIC(14,2);

-- Your real monthly expenses (for runway/projections when tracked expenses
-- understate reality; empty = use the tracked 3-month average).
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS assumed_monthly_expense NUMERIC(14,2);

CREATE TABLE IF NOT EXISTS public.asset_snapshots (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id TEXT,
    value NUMERIC(14,2),
    date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_snapshots_user ON public.asset_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_snapshots_asset ON public.asset_snapshots(asset_id);

ALTER TABLE public.asset_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own data select" ON public.asset_snapshots;
DROP POLICY IF EXISTS "users own data insert" ON public.asset_snapshots;
DROP POLICY IF EXISTS "users own data update" ON public.asset_snapshots;
DROP POLICY IF EXISTS "users own data delete" ON public.asset_snapshots;
CREATE POLICY "users own data select" ON public.asset_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users own data insert" ON public.asset_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users own data update" ON public.asset_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users own data delete" ON public.asset_snapshots FOR DELETE USING (auth.uid() = user_id);

-- Backfill: one starting snapshot per asset that has none yet, dated from the
-- asset's creation so the growth chart has a first point.
INSERT INTO public.asset_snapshots (id, user_id, asset_id, value, date)
SELECT a.id || '-init', a.user_id, a.id, a.value, COALESCE(a.created_at::date, now()::date)
FROM public.assets a
WHERE NOT EXISTS (SELECT 1 FROM public.asset_snapshots s WHERE s.asset_id = a.id)
ON CONFLICT (id) DO NOTHING;
