-- Wishlist — a flexible "things I want" list (buy items, experiences, gifts),
-- organized by category. No savings/Funds integration. Safe to run multiple times.
CREATE TABLE IF NOT EXISTS public.wishlist (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT,
    type        TEXT,                       -- 'buy' | 'experience' | 'gift'
    price       NUMERIC(14,2),              -- optional, for context only
    priority    TEXT,                       -- 'high' | 'medium' | 'low'
    url         TEXT,
    image_url   TEXT,
    category    TEXT,                       -- managed category (the primary grouping)
    for_person  TEXT,                       -- optional gift recipient
    notes       TEXT,
    status      TEXT DEFAULT 'wanted',      -- 'wanted' | 'got' | 'archived'
    got_at      TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- Owner-only access (matches every other per-user table in this app).
DROP POLICY IF EXISTS "wishlist_owner_all" ON public.wishlist;
CREATE POLICY "wishlist_owner_all" ON public.wishlist
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON public.wishlist(user_id);
