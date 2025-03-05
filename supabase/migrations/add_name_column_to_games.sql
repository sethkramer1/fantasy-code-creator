-- Add name column to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Update existing records to have a name based on the prompt
UPDATE games
SET name = SUBSTRING(prompt, 1, 50)
WHERE name IS NULL;

-- Add comment to the column
COMMENT ON COLUMN games.name IS 'Short name for the game or design, generated from the prompt or set by the user'; 