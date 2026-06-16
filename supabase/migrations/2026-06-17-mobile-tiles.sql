-- ============================================================================
-- Add mobile_dashboard_tiles column to settings table.
-- Run this in the Supabase SQL Editor — same place you ran schema.sql.
-- ============================================================================

ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS mobile_dashboard_tiles TEXT;

-- That's it. RLS is already enabled on settings and the existing
-- "users own data update" policy covers the new column.
