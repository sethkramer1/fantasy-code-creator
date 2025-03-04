
import { supabase } from "@/integrations/supabase/client";
import { ModelType } from "@/types/generation";

/**
 * Save token usage data for initial game generation
 * This function is designed to reliably save token usage from the initial generation
 * regardless of which model (Anthropic or Groq) was used
 */
export const saveInitialGenerationTokens = async (
  userId: string | undefined,
  gameId: string,
  prompt: string,
  modelType: string,
  inputTokens: number,
  outputTokens: number
): Promise<boolean> => {
  try {
    if (!gameId) {
      console.error("[TOKEN TRACKING] Cannot save initial tokens: gameId is required");
      return false;
    }
    
    // Validate token counts to prevent database errors
    const validInputTokens = Math.max(1, isNaN(inputTokens) ? Math.ceil(prompt.length / 4) : inputTokens);
    const validOutputTokens = Math.max(1, isNaN(outputTokens) ? 0 : outputTokens);
    
    console.log(`[TOKEN TRACKING] Saving initial generation tokens for game ${gameId}`);
    console.log(`[TOKEN TRACKING] Model: ${modelType}, Input: ${validInputTokens}, Output: ${validOutputTokens}`);
    
    // Use a consistent message ID format for initial generations
    const messageId = `initial-generation-${gameId}`;
    
    // Check if a record already exists for this initial generation
    const { data: existingData, error: checkError } = await supabase
      .from('token_usage')
      .select('id')
      .eq('game_id', gameId)
      .eq('message_id', messageId)
      .maybeSingle();
      
    if (checkError) {
      console.error("[TOKEN TRACKING] Error checking for existing token usage:", checkError);
    }
    
    if (existingData?.id) {
      console.log(`[TOKEN TRACKING] Updating existing token record: ${existingData.id}`);
      
      // Update existing record
      const { error: updateError } = await supabase
        .from('token_usage')
        .update({
          input_tokens: validInputTokens,
          output_tokens: validOutputTokens,
          prompt: prompt.substring(0, 5000), // Limit prompt length
          model_type: modelType,
          user_id: userId
        })
        .eq('id', existingData.id);
        
      if (updateError) {
        console.error("[TOKEN TRACKING] Error updating token usage:", updateError);
        return false;
      }
      
      console.log("[TOKEN TRACKING] Token usage updated successfully");
      return true;
    }
    
    // If no existing record, create a new one
    console.log("[TOKEN TRACKING] Creating new token usage record");
    
    const { data, error } = await supabase
      .from('token_usage')
      .insert({
        user_id: userId,
        game_id: gameId,
        message_id: messageId,
        prompt: prompt.substring(0, 5000),
        input_tokens: validInputTokens,
        output_tokens: validOutputTokens,
        model_type: modelType
      })
      .select('id')
      .single();
    
    if (error) {
      console.error("[TOKEN TRACKING] Error creating token usage record:", error);
      return false;
    }
    
    console.log("[TOKEN TRACKING] Token usage saved successfully with ID:", data?.id);
    return true;
    
  } catch (error) {
    console.error("[TOKEN TRACKING] Critical error saving tokens:", error);
    // Attempt a fallback insertion with minimal data if possible
    try {
      await supabase
        .from('token_usage')
        .insert({
          game_id: gameId,
          message_id: `initial-generation-${gameId}`,
          prompt: prompt.substring(0, 100) + "... (truncated)",
          input_tokens: Math.ceil(prompt.length / 4),
          output_tokens: 1,
          model_type: modelType || "unknown",
          user_id: userId
        });
      console.log("[TOKEN TRACKING] Emergency fallback token record created");
    } catch (fallbackError) {
      console.error("[TOKEN TRACKING] Even fallback insertion failed:", fallbackError);
    }
    return false;
  }
};
