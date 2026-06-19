-- Add per-expense budget scope so each expense can be tagged as either a
-- day-to-day "weekly" expense or a big "monthly" bill.
--   'weekly'  → counts toward the weekly budget (current week) AND the monthly total
--   'monthly' → counts toward the monthly total only (never the weekly budget)
-- The monthly view always sums everything; this flag only decides whether an
-- expense also hits the weekly budget. Safe to run multiple times.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS budget_scope TEXT;
