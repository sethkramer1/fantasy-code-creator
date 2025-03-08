
-- Function to update the initial generation message for a game
CREATE OR REPLACE FUNCTION update_initial_generation_message(game_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  initial_message_id UUID;
  updated_rows INTEGER;
BEGIN
  -- Find the initial message ID
  SELECT id INTO initial_message_id
  FROM game_messages
  WHERE game_id = game_id_param
    AND response = 'Initial generation in progress...'
  LIMIT 1;

  -- If found, update it
  IF initial_message_id IS NOT NULL THEN
    UPDATE game_messages
    SET response = 'Generation complete'
    WHERE id = initial_message_id;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows > 0;
  END IF;
  
  RETURN FALSE;
END;
$$;
