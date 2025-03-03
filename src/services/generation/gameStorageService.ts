
import { supabase } from "@/integrations/supabase/client";
import { formatSvgContent, ensureValidHtml } from "@/utils/contentTypeInstructions";

export interface SaveGameOptions {
  gameContent: string;
  prompt: string;
  gameType: string;
  modelType: string;
  imageUrl?: string;
  existingGameId?: string;
  instructions?: string;
}

export const saveGeneratedGame = async (options: SaveGameOptions) => {
  const {
    gameContent,
    prompt,
    gameType,
    modelType,
    imageUrl,
    existingGameId,
    instructions = "Content generated successfully"
  } = options;

  console.log("Saving game with options:", { 
    prompt, 
    gameType, 
    modelType, 
    existingGameId,
    contentLength: gameContent?.length || 0
  });

  if (!gameContent || gameContent.length < 100) {
    console.error("Invalid game content provided for saving:", gameContent?.substring(0, 100));
    throw new Error("Invalid or empty game content");
  }

  // Format content based on type
  let formattedContent = gameContent;
  
  // Handle SVG content type specifically
  if (gameType === 'svg') {
    formattedContent = formatSvgContent(formattedContent);
  }
  
  // Ensure we have valid HTML content
  formattedContent = ensureValidHtml(formattedContent);

  let gameData;
  
  if (existingGameId) {
    console.log(`Updating existing game: ${existingGameId}`);
    
    // Update existing game
    const { data: gameCheck, error: checkError } = await supabase
      .from('games')
      .select('id')
      .eq('id', existingGameId)
      .single();
      
    if (checkError || !gameCheck) {
      console.error("Failed to find game to update:", checkError);
      throw new Error(`Game with ID ${existingGameId} not found`);
    }

    // Update the game record
    const { error: updateError } = await supabase
      .from('games')
      .update({ 
        code: formattedContent,
        instructions: instructions
      })
      .eq('id', existingGameId);
    
    if (updateError) {
      console.error("Failed to update game:", updateError);
      throw updateError;
    }
    
    // Update the game version with the generated content
    const { error: versionError } = await supabase
      .from('game_versions')
      .update({
        code: formattedContent,
        instructions: instructions
      })
      .eq('game_id', existingGameId)
      .eq('version_number', 1);
    
    if (versionError) {
      console.error("Failed to update game version:", versionError);
      throw versionError;
    }
    
    // Get the updated game data
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', existingGameId)
      .single();
    
    if (error) {
      console.error("Failed to retrieve updated game:", error);
      throw error;
    }
    
    if (!data) {
      console.error("No data returned after game update");
      throw new Error("Failed to retrieve updated game");
    }
    
    console.log("Game updated successfully:", data.id);
    gameData = data;
  } else {
    console.log("Creating new game");
    
    // Create a new game
    const { data: newGameData, error: gameError } = await supabase
      .from('games')
      .insert([{ 
        prompt: prompt,
        code: formattedContent,
        instructions: instructions,
        current_version: 1,
        type: gameType,
        model_type: modelType
      }])
      .select()
      .single();

    if (gameError) {
      console.error("Failed to save new game:", gameError);
      throw gameError;
    }
    
    if (!newGameData) {
      console.error("No data returned after game creation");
      throw new Error("Failed to save content");
    }

    console.log("New game created:", newGameData.id);

    // Create initial version record
    const { error: versionError } = await supabase
      .from('game_versions')
      .insert([{
        game_id: newGameData.id,
        code: formattedContent,
        instructions: instructions,
        version_number: 1
      }]);

    if (versionError) {
      console.error("Failed to save game version:", versionError);
      throw versionError;
    }
    
    console.log("Game version created successfully");
    gameData = newGameData;
  }
  
  // Add initial message to game_messages
  const { error: messageError } = await supabase
    .from('game_messages')
    .insert([{
      game_id: gameData.id,
      message: prompt,
      response: instructions,
      image_url: imageUrl,
      model_type: modelType
    }]);
    
  if (messageError) {
    console.error("Error saving initial message:", messageError);
    // We don't throw here since the game was already saved
  } else {
    console.log("Initial message saved successfully");
  }
  
  return gameData;
};
