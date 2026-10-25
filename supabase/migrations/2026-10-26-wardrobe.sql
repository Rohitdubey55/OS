-- Wardrobe: clothes, saved outfits, outfit plans/wears, and your face & body.
-- Safe to run multiple times.
CREATE TABLE IF NOT EXISTS public.wardrobe_items (
    id            TEXT PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name          TEXT,
    type          TEXT,           -- top | bottom | shoes | layer | accessory
    category      TEXT,           -- Gym, Parties, Office…
    status        TEXT,           -- clean | dirty
    image         TEXT,           -- small background-removed photo (data URL)
    color         TEXT,
    purchase_date DATE,
    price         NUMERIC,
    brand         TEXT,
    size          TEXT,
    notes         TEXT,
    favorite      BOOLEAN DEFAULT false,
    wear_count    INT DEFAULT 0,
    last_worn     DATE,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wardrobe_outfits (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT,
    item_ids    TEXT,             -- JSON array of wardrobe_items ids
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wardrobe_log (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE,
    event_id    TEXT,             -- planner event id, 'gym', or '' for the whole day
    event_title TEXT,
    item_ids    TEXT,             -- JSON array of wardrobe_items ids
    worn        BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wardrobe_profile (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        TEXT,             -- JSON: face photo, skin tone, measurements, categories
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['wardrobe_items','wardrobe_outfits','wardrobe_log','wardrobe_profile'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_owner_all', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(user_id)', 'idx_' || t || '_user', t);
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_wardrobe_log_date ON public.wardrobe_log(user_id, date);
