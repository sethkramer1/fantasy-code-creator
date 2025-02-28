
-- Add image_url column to game_versions table
ALTER TABLE public.game_versions
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add thumbnail_url column to games table for the latest image
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
