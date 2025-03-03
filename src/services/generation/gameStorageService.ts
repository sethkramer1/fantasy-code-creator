
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
    // Update existing game
    const { error: updateError } = await supabase
      .from('games')
      .update({ 
        code: formattedContent,
        instructions: instructions
      })
      .eq('id', existingGameId);
    
    if (updateError) throw updateError;
    
    // Update the game version with the generated content
    const { error: versionError } = await supabase
      .from('game_versions')
      .update({
        code: formattedContent,
        instructions: instructions
      })
      .eq('game_id', existingGameId)
      .eq('version_number', 1);
    
    if (versionError) throw versionError;
    
    // Get the updated game data
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', existingGameId)
      .single();
    
    if (error) throw error;
    if (!data) throw new Error("Failed to retrieve updated game");
    
    gameData = data;
  } else {
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

    if (gameError) throw gameError;
    if (!newGameData) throw new Error("Failed to save content");

    const { error: versionError } = await supabase
      .from('game_versions')
      .insert([{
        game_id: newGameData.id,
        code: formattedContent,
        instructions: instructions,
        version_number: 1
      }]);

    if (versionError) throw versionError;
    
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
  }
  
  return gameData;
};
