-- A vision now holds goals at three horizons — 3 months, 1 year, 3 years —
-- each a short checklist, so the far-off picture breaks down into things you
-- can tick. Stored on the vision row as {"3m":[…], "1y":[…], "3y":[…]} with
-- each item {id, text, done}. Safe to run more than once.

ALTER TABLE public.vision_board ADD COLUMN IF NOT EXISTS horizon_goals_json TEXT;
