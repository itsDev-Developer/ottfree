ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS network text,
  ADD COLUMN IF NOT EXISTS script_code text,
  ADD COLUMN IF NOT EXISTS label text;