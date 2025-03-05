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
  gameName?: string;
}

export const saveGeneratedGame = async ({
  gameContent,
  prompt,
  gameType,
  modelType = "smart",
  imageUrl,
  existingGameId,
  instructions,
  visibility = "public",
  gameName
}: SaveGameOptions): Promise<GameData | null> => {
  try {
    let gameId = existingGameId;
    let newGame = !existingGameId;
    
    console.log("[GAME_STORAGE] saveGeneratedGame called with gameName:", gameName);
    
    // If there's no existing game ID, we need to create a new game record
    if (!gameId) {
      console.log("[GAME_STORAGE] Creating new game record with name:", gameName || prompt.substring(0, 50));
      
      // Create the insert data object for better debugging
      const insertData = {
        prompt,
        code: gameContent,
        type: gameType,
        current_version: 1,
        model_type: modelType,
        visibility: visibility,
        name: gameName || prompt.substring(0, 50)
      } as any; // Use type assertion to bypass TypeScript type checking
      
      console.log("[GAME_STORAGE] Insert data:", JSON.stringify({
        ...insertData,
        code: insertData.code.substring(0, 100) + "..." // Truncate code for logging
      }));
      
      const { data: gameRecord, error: gameError } = await supabase
        .from('games')
        .insert([insertData])
        .select('id')
        .single();
      
      if (gameError) {
        console.error("[GAME_STORAGE] Error creating game record:", gameError);
        throw new Error(`Database error: ${gameError.message}`);
      }
      
      gameId = gameRecord.id;
      console.log(`[GAME_STORAGE] Created new game with ID: ${gameId}`);
      
      // Verify the name was saved correctly
      const { data: verifyData, error: verifyError } = await supabase
        .from('games')
        .select('id, prompt, name')
        .eq('id', gameId)
        .single();
        
      if (verifyError) {
        console.error("[GAME_STORAGE] Error verifying game record:", verifyError);
      } else {
        console.log(`[GAME_STORAGE] Verified game record:`, verifyData);
      }
    } else {
      // If we're updating an existing game
      console.log(`[GAME_STORAGE] Updating existing game with ID: ${gameId}, name: ${gameName}`);
      
      // Create the update data object for better debugging
      const updateData = {
        code: gameContent,
        model_type: modelType
      } as any; // Use type assertion to bypass TypeScript type checking
      
      // Only include name in the update if it's provided
      if (gameName !== undefined) {
        console.log(`[GAME_STORAGE] Including name in update: ${gameName}`);
        updateData['name'] = gameName;
      } else {
        console.log(`[GAME_STORAGE] Name not provided, skipping name update`);
      }
      
      console.log("[GAME_STORAGE] Update data:", JSON.stringify({
        ...updateData,
        code: updateData.code.substring(0, 100) + "..." // Truncate code for logging
      }));
      
      // Using raw SQL for increment instead of supabase.sql
      const { data: updateResult, error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', gameId)
        .select('id');
      
      if (updateError) {
        console.error("[GAME_STORAGE] Error updating game record:", updateError);
        throw new Error(`Database error: ${updateError.message}`);
      }
      
      console.log(`[GAME_STORAGE] Update result:`, updateResult);
      
      // Verify the name was saved correctly
      const { data: verifyData, error: verifyError } = await supabase
        .from('games')
        .select('id, prompt, name')
        .eq('id', gameId)
        .single();
        
      if (verifyError) {
        console.error("[GAME_STORAGE] Error verifying game record:", verifyError);
      } else {
        console.log(`[GAME_STORAGE] Verified game record:`, verifyData);
      }
      
      // Update version count separately with RPC
      const { error: versionUpdateError } = await supabase.rpc(
        'increment_version',
        { game_id_param: gameId }
      );
      
      if (versionUpdateError) {
        console.error("[GAME_STORAGE] Error incrementing version:", versionUpdateError);
        throw new Error(`Database error: ${versionUpdateError.message}`);
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
    
    // If we uploaded an image, add it to the game_messages table instead of game_images
    if (imageUrl && !existingGameId) {
      console.log("Saving game image reference to game_messages...");
      const { error: imageError } = await supabase
        .from('game_messages')
        .insert([{
          game_id: gameId,
          image_url: imageUrl.substring(0, 500000), // Ensure we don't exceed column size limits
          message: "Initial game image",
          response: "Initial generation"
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
