-- Per-person contact cadence override (in days) for the People page.
-- When set, it overrides the relationship-based default that decides who you're
-- "due" to reach out to. NULL = use the relationship default (Family ~14d,
-- Friend/Work 30d, Network/Other 90d). Safe to run multiple times.
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS contact_frequency INTEGER;
