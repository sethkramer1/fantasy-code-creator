
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
    
    // Enhanced logging to track values
    console.log(`[TOKEN TRACKING] saveInitialGenerationTokens called with:`, {
      userId: userId || 'anonymous',
      gameId,
      modelType,
      inputTokens,
      outputTokens,
      promptLength: prompt?.length || 0
    });
    
    // Validate token counts to prevent database errors
    const validInputTokens = Math.max(1, isNaN(inputTokens) ? Math.ceil(prompt.length / 4) : inputTokens);
    const validOutputTokens = Math.max(1, isNaN(outputTokens) ? 0 : outputTokens);
    
    console.log(`[TOKEN TRACKING] Saving initial generation tokens for game ${gameId}`);
    console.log(`[TOKEN TRACKING] Model: ${modelType}, Input: ${validInputTokens}, Output: ${validOutputTokens}`);
    
    // Create a message record first to get a proper UUID
    const { data: messageData, error: messageError } = await supabase
      .from('game_messages')
      .insert({
        game_id: gameId,
        message: "Initial Generation",
        response: "Generating initial content...",
        is_system: true,
        model_type: modelType
      })
      .select('id')
      .single();
      
    if (messageError) {
      console.error("[TOKEN TRACKING] Error creating initial message record:", messageError);
      return false;
    }
    
    if (!messageData?.id) {
      console.error("[TOKEN TRACKING] Failed to get ID from created message");
      return false;
    }
    
    const messageId = messageData.id;
    console.log(`[TOKEN TRACKING] Created message record with ID: ${messageId}`);
    
    // Check if a record already exists for this initial generation message
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
    return false;
  }
};

/**
 * Update token counts for an existing message
 * This can be used to update the token counts after generation completes
 */
export const updateTokenCounts = async (
  messageId: string,
  inputTokens: number,
  outputTokens: number
): Promise<boolean> => {
  try {
    if (!messageId) {
      console.error("[TOKEN TRACKING] Cannot update token counts: messageId is required");
      return false;
    }

    console.log(`[TOKEN TRACKING] updateTokenCounts called with:`, {
      messageId,
      inputTokens,
      outputTokens
    });

    // Find the token usage record for this message
    const { data: existingData, error: checkError } = await supabase
      .from('token_usage')
      .select('id, prompt')
      .eq('message_id', messageId)
      .maybeSingle();
      
    if (checkError) {
      console.error("[TOKEN TRACKING] Error checking for existing token usage:", checkError);
      return false;
    }
    
    if (!existingData?.id) {
      console.error("[TOKEN TRACKING] No token usage record found for message:", messageId);
      
      // Try to get the game_id from the message record
      const { data: messageData, error: messageError } = await supabase
        .from('game_messages')
        .select('game_id, model_type')
        .eq('id', messageId)
        .single();
        
      if (messageError || !messageData) {
        console.error("[TOKEN TRACKING] Error retrieving message data:", messageError);
        return false;
      }
      
      // Create a new token usage record since one doesn't exist
      console.log(`[TOKEN TRACKING] Creating new token usage record for message ${messageId}`);
      
      const { data: insertData, error: insertError } = await supabase
        .from('token_usage')
        .insert({
          message_id: messageId,
          game_id: messageData.game_id,
          model_type: messageData.model_type || 'unknown',
          input_tokens: Math.max(1, inputTokens),
          output_tokens: Math.max(1, outputTokens),
          prompt: "Token update - no prompt available" // Add default prompt value
        })
        .select('id');
        
      if (insertError) {
        console.error("[TOKEN TRACKING] Error creating token usage record:", insertError);
        return false;
      }
      
      console.log("[TOKEN TRACKING] New token usage record created successfully with ID:", insertData?.[0]?.id);
      return true;
    }

    // Update the token counts
    const { data: updateData, error: updateError } = await supabase
      .from('token_usage')
      .update({
        input_tokens: Math.max(1, inputTokens),
        output_tokens: Math.max(1, outputTokens),
        // Keep the existing prompt when updating
        prompt: existingData.prompt || "Token update - prompt preserved" 
      })
      .eq('id', existingData.id)
      .select('id');
      
    if (updateError) {
      console.error("[TOKEN TRACKING] Error updating token counts:", updateError);
      return false;
    }
    
    console.log("[TOKEN TRACKING] Token counts updated successfully for record:", updateData?.[0]?.id);
    return true;
  } catch (error) {
    console.error("[TOKEN TRACKING] Error updating token counts:", error);
    return false;
  }
};

/**
 * Force token tracking for a game - this is a last resort if other methods fail
 */
export const forceTokenTracking = async (
  gameId: string,
  userId: string | undefined,
  prompt: string,
  modelType: string,
  inputTokens: number,
  outputTokens: number
): Promise<boolean> => {
  try {
    console.log(`[TOKEN TRACKING] FORCE TOKEN TRACKING for game ${gameId}`);
    console.log(`[TOKEN TRACKING] Using input: ${inputTokens}, output: ${outputTokens} tokens`);
    
    // Create a dedicated message for this forced tracking
    const { data: messageData, error: messageError } = await supabase
      .from('game_messages')
      .insert({
        game_id: gameId,
        message: "Initial Generation (Forced Tracking)",
        response: "Tokens tracked via forced method",
        is_system: true,
        model_type: modelType
      })
      .select('id')
      .single();
      
    if (messageError) {
      console.error("[TOKEN TRACKING] Error creating forced tracking message:", messageError);
      return false;
    }
    
    if (!messageData?.id) {
      console.error("[TOKEN TRACKING] Failed to get message ID for forced tracking");
      return false;
    }
    
    // Create the token usage record directly
    const { data, error } = await supabase
      .from('token_usage')
      .insert({
        user_id: userId,
        game_id: gameId,
        message_id: messageData.id,
        prompt: prompt.substring(0, 5000),
        input_tokens: Math.max(1, inputTokens),
        output_tokens: Math.max(1, outputTokens),
        model_type: modelType
      })
      .select('id')
      .single();
      
    if (error) {
      console.error("[TOKEN TRACKING] Error creating forced token record:", error);
      return false;
    }
    
    console.log("[TOKEN TRACKING] Forced token tracking successful with ID:", data?.id);
    return true;
    
  } catch (error) {
    console.error("[TOKEN TRACKING] Error in forced token tracking:", error);
    return false;
  }
};
