-- Per-element styling for Mural: text formatting (font size, colour, bold, align)
-- and connector stroke width. Fill colour and connector colour/line-style/arrow
-- already existed. Safe to run multiple times.
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS font_size   INTEGER;
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS text_color  TEXT;
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS bold        BOOLEAN;
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS text_align  TEXT;
ALTER TABLE public.mural_elements ADD COLUMN IF NOT EXISTS stroke_width INTEGER;
