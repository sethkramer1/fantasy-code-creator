
-- Add image_url column to game_messages table
ALTER TABLE public.game_messages
ADD COLUMN IF NOT EXISTS image_url TEXT;
