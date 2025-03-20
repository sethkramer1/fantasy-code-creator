import { supabase } from "@/integrations/supabase/client";
import { Message } from "./types";

export const fetchChatHistory = async (gameId: string, initialMessage?: string) => {
  try {
    console.log(`Fetching chat history for game: ${gameId}`);
    
    const { data, error } = await supabase
      .from('game_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error("Supabase error fetching chat history:", error);
      throw error;
    }
    
    console.log(`Fetched ${data?.length || 0} messages`);
    
    // Clean up: Check for duplicate status messages
    if (data && data.length > 0) {
      const statusMessages = data.filter(msg => 
        (msg.is_system && 
         (msg.message === "Initial generation complete" || 
          msg.message === "Welcome" || 
          msg.message === "Generation Complete" ||
          msg.message === "Initial Generation" ||
          msg.message === "Content generated"))
      );
      
      // If we find multiple status messages, delete the extras directly from the database
      if (statusMessages.length > 1) {
        console.log(`Found ${statusMessages.length} duplicate status messages, cleaning up...`);
        
        // Keep only the first one
        for (let i = 1; i < statusMessages.length; i++) {
          await supabase
            .from('game_messages')
            .delete()
            .eq('id', statusMessages[i].id);
            
          console.log(`Deleted duplicate status message: ${statusMessages[i].id}`);
        }
      }
    }
    
    if (data?.length === 0 && initialMessage) {
      console.log("No messages found, creating initial message");
      const newMessage: Message = {
        id: 'initial-message',
        message: initialMessage,
        created_at: new Date().toISOString(),
        response: "Generating initial content..."
      };
      
      return [newMessage];
    } else {
      return data || [];
    }
  } catch (error) {
    console.error("Error fetching chat history:", error);
    throw error;
  }
};

export const saveMessage = async (
  gameId: string, 
  message: string, 
  modelType: string, 
  imageUrl: string | null
) => {
  try {
    const insertData: any = {
      game_id: gameId,
      message: message,
      model_type: modelType
    };
    
    if (imageUrl) {
      insertData.image_url = imageUrl;
    }
    
    const { data, error } = await supabase
      .from('game_messages')
      .insert(insertData)
      .select()
      .single();
    
    if (error) throw error;
    if (!data) throw new Error("No data returned from message insert");
    
    return data;
  } catch (error) {
    console.error("Error saving message:", error);
    throw error;
  }
};

export const updateMessageResponse = async (messageId: string, response: string) => {
  try {
    const { error } = await supabase
      .from('game_messages')
      .update({ response })
      .eq('id', messageId);
    
    if (error) throw error;
  } catch (error) {
    console.error("Error updating message response:", error);
    throw error;
  }
};

export const trackTokenUsage = async (
  userId: string | undefined,
  gameId: string,
  messageId: string,
  prompt: string,
  inputTokens: number,
  outputTokens: number,
  modelType: string
) => {
  try {
    if (!gameId) {
      console.error("Cannot track token usage: gameId is required");
      return null;
    }
    
    if (!messageId) {
      console.error("Cannot track token usage: messageId is required");
      return null;
    }
    
    // Validate input to avoid bad database entries
    const validInputTokens = Math.max(1, isNaN(inputTokens) ? Math.ceil(prompt.length / 4) : inputTokens);
    const validOutputTokens = Math.max(1, isNaN(outputTokens) ? 0 : outputTokens);
    
    console.log(`[TOKEN TRACKING] Tracking token usage: ${validInputTokens} input / ${validOutputTokens} output tokens for model ${modelType}`);
    console.log(`[TOKEN TRACKING] Message ID: ${messageId}, Game ID: ${gameId}, User ID: ${userId || 'anonymous'}`);
    
    // Check if a record already exists for this message and game
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
      console.log(`[TOKEN TRACKING] Token usage already exists for this message (${existingData.id}), updating...`);
      
      const { data: updatedData, error: updateError } = await supabase
        .from('token_usage')
        .update({
          input_tokens: validInputTokens,
          output_tokens: validOutputTokens,
          prompt: prompt.substring(0, 5000), // Limit prompt length to avoid DB issues
          model_type: modelType,
          user_id: userId // Update userId in case it wasn't set before
        })
        .eq('id', existingData.id)
        .select('id')
        .single();
        
      if (updateError) {
        console.error("[TOKEN TRACKING] Error updating token usage:", updateError);
        return null;
      }
      
      console.log("[TOKEN TRACKING] Token usage updated successfully with ID:", updatedData?.id);
      return updatedData;
    }
    
    // Create new token usage record
    const insertData = {
      user_id: userId,
      game_id: gameId,
      message_id: messageId,
      prompt: prompt.substring(0, 5000), // Limit prompt length to avoid DB issues
      input_tokens: validInputTokens,
      output_tokens: validOutputTokens,
      model_type: modelType
    };
    
    console.log("[TOKEN TRACKING] Insert data for token_usage:", insertData);
    
    const { data, error } = await supabase
      .from('token_usage')
      .insert(insertData)
      .select('id')
      .single();
    
    if (error) {
      console.error("[TOKEN TRACKING] Error tracking token usage:", error);
      return null;
    }
    
    console.log("[TOKEN TRACKING] Token usage tracked successfully with ID:", data?.id);
    return data;
  } catch (error) {
    console.error("[TOKEN TRACKING] Error in trackTokenUsage:", error);
    // Not throwing here to prevent disrupting the main flow
    return null;
  }
};

export const fetchTokenUsageHistory = async (userId: string | undefined) => {
  if (!userId) {
    return { data: null, error: new Error("User ID is required") };
  }
  
  try {
    const { data, error } = await supabase
      .from('token_usage')
      .select(`
        id,
        game_id,
        message_id,
        input_tokens,
        output_tokens,
        model_type,
        created_at,
        games(prompt)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error("Error fetching token usage history:", error);
    return { data: null, error };
  }
};

export const processGameUpdate = async (
  gameId: string,
  message: string,
  modelType: string,
  imageUrl?: string | null,
  updateTerminalOutput?: (text: string, isNewMessage?: boolean) => void
) => {
  try {
    const payload: {
      gameId: string;
      message: string;
      modelType: string;
      imageUrl?: string | null;
      stream?: boolean;
      thinking?: {
        type: string;
        budget_tokens: number;
      };
    } = {
      gameId,
      message,
      modelType
    };
    
    if (imageUrl) {
      payload.imageUrl = imageUrl;
    }
    
    // Always enable streaming for Anthropic (smart) model
    if (modelType === "smart") {
      payload.stream = true;
      payload.thinking = {
        type: "enabled",
        budget_tokens: 10000
      };
    }
    
    const apiUrl = modelType === "fast" 
      ? 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/process-game-update-with-groq'
      : 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/process-game-update';
    
    if (updateTerminalOutput) {
      updateTerminalOutput(`> Connecting to ${modelType === "fast" ? "Groq" : "Anthropic"} API...`, true);
    }
    
    console.log(`Sending request to ${modelType === "fast" ? "Groq" : "Anthropic"} API:`, {
      url: apiUrl,
      streaming: modelType === "smart" ? true : false,
      messageLength: message.length,
      hasImage: !!imageUrl
    });
    
    // Add a timeout to the fetch request - increased from 60 to 400 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error("API request timed out after 400 seconds");
      if (updateTerminalOutput) {
        updateTerminalOutput("> Error: API request timed out after 400 seconds", true);
      }
    }, 400000); // 400 second timeout
    
    try {
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log("API response status:", apiResponse.status);
      console.log("API response headers:", Object.fromEntries(apiResponse.headers.entries()));
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("API response error:", apiResponse.status, errorText);
        if (updateTerminalOutput) {
          updateTerminalOutput(`> Error: API returned status ${apiResponse.status}`, true);
          updateTerminalOutput(`> ${errorText.substring(0, 200)}`, true);
        }
        throw new Error(`API error (${apiResponse.status}): ${errorText.substring(0, 200)}`);
      }
      
      // Ensure we're properly handling the response based on content type
      const contentType = apiResponse.headers.get('content-type');
      console.log("Response content type:", contentType);
      
      // For streaming responses, verify the content type is correct
      if (modelType === "smart" && payload.stream) {
        if (!contentType || !contentType.includes('text/event-stream')) {
          console.warn("Expected streaming response but got:", contentType);
          if (updateTerminalOutput) {
            updateTerminalOutput("> Warning: Expected streaming response but received non-streaming response", true);
          }
          
          // If we didn't get a streaming response, try to handle it as a regular JSON response
          try {
            const jsonData = await apiResponse.json();
            console.log("Received non-streaming response:", jsonData);
            
            // Create a new Response object with the JSON data
            const jsonResponse = new Response(JSON.stringify(jsonData), {
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            return { apiResponse: jsonResponse, modelType };
          } catch (e) {
            console.error("Failed to parse non-streaming response:", e);
            if (updateTerminalOutput) {
              updateTerminalOutput("> Error: Failed to parse non-streaming response", true);
            }
            throw new Error("Received invalid response format from API");
          }
        } else {
          console.log("Received proper streaming response");
          if (updateTerminalOutput) {
            updateTerminalOutput("> Received streaming response, processing...", true);
          }
          
          // Ensure the response body is available
          if (!apiResponse.body) {
            console.error("Streaming response has no body");
            if (updateTerminalOutput) {
              updateTerminalOutput("> Error: Streaming response has no body", true);
            }
            throw new Error("Streaming response has no body");
          }
        }
      }
      
      return { apiResponse, modelType };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("API request error:", error);
      if (updateTerminalOutput) {
        updateTerminalOutput(`> Error: ${error.message}`, true);
      }
      throw error;
    }
  } catch (error) {
    console.error("API error:", error);
    throw error;
  }
};

export const trackInitialGameTokens = async (
  userId: string | undefined,
  gameId: string,
  prompt: string,
  modelType: string,
  inputTokens: number,
  outputTokens: number
) => {
  try {
    if (!gameId) {
      console.error("[INITIAL TOKEN TRACKING] Cannot track initial tokens: gameId is required");
      return null;
    }
    
    const messageId = `initial-generation-${gameId}`;
    console.log(`[INITIAL TOKEN TRACKING] Tracking initial token usage for game ${gameId}, model ${modelType}`);
    console.log(`[INITIAL TOKEN TRACKING] Input tokens: ${inputTokens}, Output tokens: ${outputTokens}`);
    
    // First, check if there's already a token_usage entry for this initial generation
    const { data: existingData, error: checkError } = await supabase
      .from('token_usage')
      .select('id')
      .eq('game_id', gameId)
      .eq('message_id', messageId)
      .maybeSingle();
      
    if (checkError) {
      console.error("[INITIAL TOKEN TRACKING] Error checking for existing token usage:", checkError);
    }
    
    // If entry already exists, update it
    if (existingData?.id) {
      console.log(`[INITIAL TOKEN TRACKING] Token usage already exists for initial generation (${existingData.id}), updating...`);
      
      const { data: updatedData, error: updateError } = await supabase
        .from('token_usage')
        .update({
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          prompt: prompt.substring(0, 5000),
          model_type: modelType,
          user_id: userId
        })
        .eq('id', existingData.id)
        .select('id')
        .single();
        
      if (updateError) {
        console.error("[INITIAL TOKEN TRACKING] Error updating token usage:", updateError);
        return null;
      }
      
      console.log("[INITIAL TOKEN TRACKING] Token usage updated successfully with ID:", updatedData?.id);
      return updatedData;
    }
    
    // Create new token usage record for initial generation
    const result = await trackTokenUsage(
      userId,
      gameId,
      messageId,
      prompt,
      inputTokens,
      outputTokens,
      modelType
    );
    
    return result;
  } catch (error) {
    console.error("[INITIAL TOKEN TRACKING] Error tracking initial tokens:", error);
    return null;
  }
};
