-- Calories & protein for the Food Planner. Safe to run multiple times.
-- meal_items: numbers per usual serving of a food ("My foods").
ALTER TABLE public.meal_items ADD COLUMN IF NOT EXISTS kcal INT;
ALTER TABLE public.meal_items ADD COLUMN IF NOT EXISTS protein NUMERIC;
-- meal_plan: numbers typed for one specific meal (overrides the food's numbers).
ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS kcal INT;
ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS protein NUMERIC;
-- meal_day: extras eaten outside the meal slots (snacks, drinks…).
ALTER TABLE public.meal_day ADD COLUMN IF NOT EXISTS extra_kcal INT;
ALTER TABLE public.meal_day ADD COLUMN IF NOT EXISTS extra_protein NUMERIC;
-- settings: daily goals as JSON, e.g. {"kcal":2200,"protein":120}
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS nutrition_goals TEXT;
