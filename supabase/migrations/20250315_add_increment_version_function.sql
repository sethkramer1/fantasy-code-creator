
-- Function to increment the current_version field for a game
CREATE OR REPLACE FUNCTION increment_version(game_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE games
  SET current_version = current_version + 1
  WHERE id = game_id_param;
END;
$$;

-- Store image data in game_messages instead of a separate game_images table
CREATE INDEX IF NOT EXISTS idx_game_messages_game_id ON game_messages(game_id);

