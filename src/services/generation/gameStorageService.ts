
import { supabase } from "@/integrations/supabase/client";
import { formatSvgContent, ensureValidHtml } from "@/utils/contentTypeInstructions";
import { ModelType } from "@/types/generation";

export interface SaveGameOptions {
  gameContent: string;
  prompt: string;
  gameType: string;
  modelType: ModelType;
  imageUrl?: string;
  existingGameId?: string;
  instructions?: string;
  userId?: string;
  visibility?: string;
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
    userId,
    visibility = "public"
  } = options;

  console.log("Saving game with options:", { 
    promptLength: prompt?.length || 0, 
    gameType, 
    modelType, 
    existingGameId,
    contentLength: gameContent?.length || 0,
    hasUserId: !!userId,
    visibility
  });

  // Validate game content
  if (!gameContent) {
    console.error("Empty game content provided for saving");
    throw new Error("Empty game content provided");
  }

  if (gameContent.length < 100) {
    console.error("Game content too short for saving:", gameContent.substring(0, 100));
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
        .maybeSingle();
        
      if (checkError) {
        console.error("Failed to find game to update:", checkError);
        throw new Error(`Error checking game existence: ${checkError.message}`);
      }
      
      if (!gameCheck) {
        console.error(`Game with ID ${existingGameId} not found, creating new game instead`);
        // Fall through to the creation logic below with existingGameId set to undefined
        const { data: newGameData, error: gameError } = await supabase
          .from('games')
          .insert([{ 
            prompt: prompt,
            code: formattedContent,
            instructions: instructions,
            current_version: 1,
            type: gameType,
            model_type: modelType,
            user_id: userId,
            visibility: visibility
          }])
          .select()
          .maybeSingle();

        if (gameError) {
          console.error("Failed to create new game after update failed:", gameError);
          throw gameError;
        }
        
        if (!newGameData) {
          console.error("New game data is null after insert");
          throw new Error("Failed to create new game: No data returned from insert");
        }
        
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
          // Continue without throwing, as the game was created
        }
      } else {
        // Game exists, proceed with update
        const { data: updateData, error: updateError } = await supabase
          .from('games')
          .update({ 
            code: formattedContent,
            instructions: instructions,
            user_id: userId,
            visibility: visibility
          })
          .eq('id', existingGameId)
          .select()
          .maybeSingle();
        
        if (updateError) {
          console.error("Failed to update game:", updateError);
          throw updateError;
        }
        
        if (!updateData) {
          console.error("Update game data is null after update");
          throw new Error("Failed to update game: No data returned");
        }
        
        gameData = updateData;
        
        // Get the latest version number to ensure we don't create conflicts
        const { data: versionData, error: versionQueryError } = await supabase
          .from('game_versions')
          .select('version_number')
          .eq('game_id', existingGameId)
          .order('version_number', { ascending: false })
          .limit(1);
          
        if (versionQueryError) {
          console.error("Error fetching version data:", versionQueryError);
          // Continue without throwing, we'll use a default version number
        }
        
        const latestVersionNumber = versionData && versionData.length > 0 
          ? versionData[0].version_number 
          : 0;
        
        // Insert a new game version with the generated content
        const { error: versionError } = await supabase
          .from('game_versions')
          .insert([{
            game_id: existingGameId,
            code: formattedContent,
            instructions: instructions,
            version_number: latestVersionNumber + 1
          }]);
        
        if (versionError) {
          console.error("Failed to create new game version:", versionError);
          // Don't throw here, as the game was already updated
        }
        
        // Update the game's current version
        const { error: currentVersionError } = await supabase
          .from('games')
          .update({ current_version: latestVersionNumber + 1 })
          .eq('id', existingGameId);
          
        if (currentVersionError) {
          console.error("Failed to update current version:", currentVersionError);
          // Don't throw here either
        }
      }
      
      console.log("Game updated successfully:", gameData?.id);
    } else {
      console.log("Creating new game with model type:", modelType);
      
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
          user_id: userId,
          visibility: visibility
        }])
        .select()
        .maybeSingle();

      if (gameError) {
        console.error("Failed to save new game:", gameError);
        throw gameError;
      }
      
      if (!newGameData) {
        console.error("New game data is null after insert");
        throw new Error("Failed to create new game: No data returned from insert");
      }
      
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
    if (gameData) {
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
    } else {
      console.error("Cannot save game message - game data is undefined");
    }
  } catch (error) {
    console.error("Error saving game message:", error);
    // Don't throw, as the game was already saved/updated
  }
  
  return gameData;
};
