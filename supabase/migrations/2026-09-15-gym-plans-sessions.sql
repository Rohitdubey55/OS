-- Fix for the Gym page: view-gym.js reads/writes the `gym_plans` and
-- `gym_sessions` tables (workout plan templates + the daily logged session),
-- but the original schema.sql only ever created `gym_workouts` (an older,
-- unused flat-log table) and `gym_exercises`. Every Gym page load/save was
-- silently failing against Postgres because these two tables never existed.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.gym_plans (
    id             TEXT PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name           TEXT,
    exercises_json TEXT,                 -- JSON array of {name, muscle_group, category, sets:[{reps,weight}]}
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_sessions (
    id            TEXT PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date          DATE,
    plan_id       TEXT,                  -- references gym_plans.id, blank for a "blank session"
    plan_name     TEXT,
    workout_json  TEXT,                  -- JSON: {exercises:[...], started_at, completed_at}
    completed     BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gym_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gym_plans_owner_all" ON public.gym_plans;
CREATE POLICY "gym_plans_owner_all" ON public.gym_plans
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gym_sessions_owner_all" ON public.gym_sessions;
CREATE POLICY "gym_sessions_owner_all" ON public.gym_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gym_plans_user ON public.gym_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_sessions_user_date ON public.gym_sessions(user_id, date DESC);

DROP TRIGGER IF EXISTS trg_gym_plans_updated_at ON public.gym_plans;
CREATE TRIGGER trg_gym_plans_updated_at BEFORE UPDATE ON public.gym_plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_gym_sessions_updated_at ON public.gym_sessions;
CREATE TRIGGER trg_gym_sessions_updated_at BEFORE UPDATE ON public.gym_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
