-- Journal templates can carry a day plan: [{ "start": "10:00", "end": "11:00", "title": "..." }].
-- Using the template adds these blocks to the Planner for that date; the default
-- template (is_default = true) fills today's plan automatically.
ALTER TABLE public.diary_templates ADD COLUMN IF NOT EXISTS plan_json TEXT;
