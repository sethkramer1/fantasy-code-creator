
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
  userId?: string;
}

export const saveGeneratedGame = async (options: SaveGameOptions) => {
  const {
    gameContent,
    prompt,
    gameType,
    modelType,
    imageUrl,
    existingGameId,
    instructions = "Content generated successfully",
    userId
  } = options;

  console.log("Saving game with options:", { 
    prompt, 
    gameType, 
    modelType, 
    existingGameId,
    contentLength: gameContent?.length || 0,
    userId: userId ? "provided" : "not provided"
  });

  // Validate game content
  if (!gameContent) {
    console.error("Empty game content provided for saving");
    throw new Error("Empty game content provided");
  }

  if (gameContent.length < 100) {
    console.error("Game content too short for saving:", gameContent?.substring(0, 100));
    throw new Error("Game content too short (less than 100 characters)");
  }

  // Format content based on type
  let formattedContent;
  try {
    // Handle SVG content type specifically
    if (gameType === 'svg') {
      formattedContent = formatSvgContent(gameContent);
    } else {
      formattedContent = gameContent;
    }
    
    // Ensure we have valid HTML content
    formattedContent = ensureValidHtml(formattedContent);
  } catch (error) {
    console.error("Error formatting game content:", error);
    throw new Error(`Failed to format game content: ${error.message}`);
  }

  let gameData;
  
  try {
    if (existingGameId) {
      console.log(`Updating existing game: ${existingGameId}`);
      
      // Check if game exists
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
      const { data: updateData, error: updateError } = await supabase
        .from('games')
        .update({ 
          code: formattedContent,
          instructions: instructions,
          user_id: userId
        })
        .eq('id', existingGameId)
        .select()
        .single();
      
      if (updateError) {
        console.error("Failed to update game:", updateError);
        throw updateError;
      }
      
      if (!updateData) {
        console.error("No data returned after game update");
        throw new Error("Failed to update game - no data returned");
      }
      
      gameData = updateData;
      
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
        // Don't throw here, as the game was already updated
      }
      
      console.log("Game updated successfully:", gameData.id);
    } else {
      console.log("Creating new game", userId ? "for user" : "without user");
      
      // Create a new game
      const { data: newGameData, error: gameError } = await supabase
        .from('games')
        .insert([{ 
          prompt: prompt,
          code: formattedContent,
          instructions: instructions,
          current_version: 1,
          type: gameType,
          model_type: modelType,
          user_id: userId
        }])
        .select()
        .single();

      if (gameError) {
        console.error("Failed to save new game:", gameError);
        throw gameError;
      }
      
      if (!newGameData) {
        console.error("No data returned after game creation");
        throw new Error("Failed to save new game - no data returned");
      }

      console.log("New game created:", newGameData.id);
      gameData = newGameData;

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
        // Don't throw here, as the game was already created
      } else {
        console.log("Game version created successfully");
      }
    }
  } catch (error) {
    console.error("Database error in saveGeneratedGame:", error);
    throw new Error(`Database error: ${error.message}`);
  }
  
  // Add initial message to game_messages
  try {
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
  } catch (error) {
    console.error("Error saving game message:", error);
    // Don't throw, as the game was already saved/updated
  }
  
  return gameData;
};
