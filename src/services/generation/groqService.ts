import { contentTypes } from "@/types/game";
import { getContentTypeInstructions } from "@/utils/contentTypeInstructions";
import { supabase } from "@/integrations/supabase/client";

const GROQ_API_ENDPOINT = 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-with-groq';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo';

export interface GroqCallbacks {
  onContent: (content: string) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
  onStreamStart: () => void;
}

export interface TokenInfo {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Save token usage data for initial game generation
 * This function is specifically designed to reliably save token usage from the initial generation
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
      console.error("[TOKEN SAVING] Cannot save initial tokens: gameId is required");
      return false;
    }
    
    // Validate token counts to prevent database errors
    const validInputTokens = Math.max(1, isNaN(inputTokens) ? Math.ceil(prompt.length / 4) : inputTokens);
    const validOutputTokens = Math.max(1, isNaN(outputTokens) ? 0 : outputTokens);
    
    console.log(`[TOKEN SAVING] Saving initial generation tokens for game ${gameId}`);
    console.log(`[TOKEN SAVING] Model: ${modelType}, Input: ${validInputTokens}, Output: ${validOutputTokens}`);
    
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
      console.error("[TOKEN SAVING] Error checking for existing token usage:", checkError);
    }
    
    if (existingData?.id) {
      console.log(`[TOKEN SAVING] Updating existing token record: ${existingData.id}`);
      
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
        console.error("[TOKEN SAVING] Error updating token usage:", updateError);
        return false;
      }
      
      console.log("[TOKEN SAVING] Token usage updated successfully");
      return true;
    }
    
    // If no existing record, create a new one
    console.log("[TOKEN SAVING] Creating new token usage record");
    
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
      console.error("[TOKEN SAVING] Error creating token usage record:", error);
      return false;
    }
    
    console.log("[TOKEN SAVING] Token usage saved successfully with ID:", data?.id);
    return true;
    
  } catch (error) {
    console.error("[TOKEN SAVING] Critical error saving tokens:", error);
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
      console.log("[TOKEN SAVING] Emergency fallback token record created");
    } catch (fallbackError) {
      console.error("[TOKEN SAVING] Even fallback insertion failed:", fallbackError);
    }
    return false;
  }
};

export const callGroqApi = async (
  prompt: string,
  gameType: string,
  imageUrl?: string,
  callbacks?: GroqCallbacks
): Promise<{ response: Response, gameContent: string, tokenInfo: TokenInfo }> => {
  let gameContent = '';
  let tokenInfo: TokenInfo = {
    inputTokens: Math.ceil(prompt.length / 4),
    outputTokens: 0
  };
  
  const selectedType = contentTypes.find(type => type.id === gameType);
  if (!selectedType) throw new Error("Invalid content type selected");

  const enhancedPrompt = selectedType.promptPrefix + " " + prompt;
  const { systemInstructions } = getContentTypeInstructions(gameType);
  
  const finalPrompt = `${systemInstructions}\n\n${enhancedPrompt}`;
  
  callbacks?.onStreamStart();
  
  console.log("[GROQ] Calling Groq API with:", {
    promptLength: finalPrompt.length,
    imageUrl: imageUrl ? "provided" : "none"
  });
  
  const response = await fetch(
    GROQ_API_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        prompt: finalPrompt,
        imageUrl: imageUrl,
        contentType: gameType,
        stream: false // Disable streaming for Groq
      }),
      signal: AbortSignal.timeout(180000), // 3 minute timeout
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorJson.error || errorJson.message || 'Unknown error'}`);
    } catch (e) {
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText.substring(0, 100)}...`);
    }
  }
  
  // Process non-streaming Groq response
  callbacks?.onStreamStart();
  
  const data = await response.json();
  if (data.error) {
    throw new Error(`Groq API error: ${data.error}`);
  }
  
  // Extract the content from the non-streaming response
  if (data.choices && data.choices[0] && data.choices[0].message) {
    const content = data.choices[0].message.content;
    gameContent = content;
    
    // Display content in chunks for better visibility
    const contentLines = content.split('\n');
    for (const contentLine of contentLines) {
      if (contentLine.trim()) {
        callbacks?.onContent(contentLine);
      }
    }
    
    callbacks?.onComplete();
  } else {
    throw new Error("Invalid response format from Groq API");
  }

  // Extract token usage information from the Groq response with better error handling
  if (data.usage) {
    console.log("[GROQ] Token usage from Groq:", data.usage);
    
    // In Groq's response, prompt_tokens are the input tokens and completion_tokens are the output tokens
    tokenInfo = {
      inputTokens: data.usage.prompt_tokens || tokenInfo.inputTokens,
      outputTokens: data.usage.completion_tokens || Math.ceil(gameContent.length / 4)
    };
    
    callbacks?.onContent(`Tokens used: ${tokenInfo.inputTokens} input, ${tokenInfo.outputTokens} output`);
    console.log("[GROQ] Extracted token usage from Groq:", tokenInfo);
  } else {
    console.log("[GROQ] No token usage info in Groq response, using estimates");
    tokenInfo.outputTokens = Math.ceil(gameContent.length / 4);
  }

  console.log("[GROQ] Final token usage for Groq:", tokenInfo);
  return { response, gameContent, tokenInfo };
};
