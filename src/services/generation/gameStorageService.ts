import { supabase } from "@/integrations/supabase/client";
import { GameData } from "@/types/game";

interface SaveGameOptions {
  gameContent: string;
  prompt: string;
  gameType: string;
  modelType?: string;
  imageUrl?: string;
  existingGameId?: string;
  instructions?: string;
  visibility?: string;
}

export const saveGeneratedGame = async ({
  gameContent,
  prompt,
  gameType,
  modelType = "smart",
  imageUrl,
  existingGameId,
  instructions,
  visibility = "public"
}: SaveGameOptions): Promise<GameData | null> => {
  try {
    let gameId = existingGameId;
    let newGame = !existingGameId;
    
    // If there's no existing game ID, we need to create a new game record
    if (!gameId) {
      console.log("Creating new game record...");
      const { data: gameRecord, error: gameError } = await supabase
        .from('games')
        .insert([{
          prompt,
          code: gameContent,
          type: gameType,
          current_version: 1,
          model_type: modelType,
          visibility: visibility
        }])
        .select('id')
        .single();
      
      if (gameError) {
        console.error("Error creating game record:", gameError);
        throw new Error(`Database error: ${gameError.message}`);
      }
      
      gameId = gameRecord.id;
      console.log(`Created new game with ID: ${gameId}`);
    } else {
      // If we're updating an existing game
      console.log(`Updating existing game with ID: ${gameId}`);
      const { error: updateError } = await supabase
        .from('games')
        .update({
          code: gameContent,
          current_version: supabase.sql`current_version + 1`,
          model_type: modelType
        })
        .eq('id', gameId);
      
      if (updateError) {
        console.error("Error updating game record:", updateError);
        throw new Error(`Database error: ${updateError.message}`);
      }
    }
    
    // Fetch the current version number
    const { data: versionData, error: versionFetchError } = await supabase
      .from('games')
      .select('current_version')
      .eq('id', gameId)
      .single();
    
    if (versionFetchError) {
      console.error("Error fetching game version:", versionFetchError);
      throw new Error(`Database error: ${versionFetchError.message}`);
    }
    
    const versionNumber = versionData?.current_version || 1;
    
    // Create a new version record
    console.log(`Creating version ${versionNumber} for game ${gameId}`);
    const { error: versionError } = await supabase
      .from('game_versions')
      .insert([{
        game_id: gameId,
        code: gameContent,
        version_number: versionNumber,
        instructions: instructions || (newGame ? 'Initial generation' : 'Updated content')
      }]);
    
    if (versionError) {
      console.error("Error creating version record:", versionError);
      throw new Error(`Database error: ${versionError.message}`);
    }
    
    // If we uploaded an image, add it to the game_images table
    if (imageUrl && !existingGameId) {
      console.log("Saving game image reference...");
      const { error: imageError } = await supabase
        .from('game_images')
        .insert([{
          game_id: gameId,
          image_url: imageUrl.substring(0, 500000) // Ensure we don't exceed column size limits
        }]);
      
      if (imageError) {
        console.error("Error saving image reference:", imageError);
        // Non-fatal error, continue without the image reference
      }
    }
    
    // Return the complete game data
    console.log("Fetching complete game data...");
    const { data: completeGameData, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (fetchError) {
      console.error("Error fetching complete game data:", fetchError);
      throw new Error(`Database error: ${fetchError.message}`);
    }
    
    console.log("Game saved successfully");
    return completeGameData as GameData;
    
  } catch (error) {
    console.error("Error in saveGeneratedGame:", error);
    throw error;
  }
};
