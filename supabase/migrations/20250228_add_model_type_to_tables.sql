
-- Add model_type column to games table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute 
                 WHERE attrelid = 'games'::regclass
                 AND attname = 'model_type' 
                 AND NOT attisdropped) THEN
    ALTER TABLE "public"."games" 
    ADD COLUMN "model_type" text DEFAULT 'smart';
  END IF;
END $$;

-- Add model_type column to game_messages table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute 
                 WHERE attrelid = 'game_messages'::regclass
                 AND attname = 'model_type' 
                 AND NOT attisdropped) THEN
    ALTER TABLE "public"."game_messages" 
    ADD COLUMN "model_type" text DEFAULT 'smart';
  END IF;
END $$;
