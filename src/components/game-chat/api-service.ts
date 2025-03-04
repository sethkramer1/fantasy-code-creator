
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
    
    // Validate input to avoid bad database entries
    const validInputTokens = Math.max(1, isNaN(inputTokens) ? Math.ceil(prompt.length / 4) : inputTokens);
    const validOutputTokens = Math.max(1, isNaN(outputTokens) ? 0 : outputTokens);
    
    console.log(`Tracking token usage: ${validInputTokens} input / ${validOutputTokens} output tokens for model ${modelType}`);
    console.log(`Message ID: ${messageId}, Game ID: ${gameId}, User ID: ${userId || 'anonymous'}`);
    
    const insertData = {
      user_id: userId,
      game_id: gameId,
      message_id: messageId,
      prompt: prompt.substring(0, 5000), // Limit prompt length to avoid DB issues
      input_tokens: validInputTokens,
      output_tokens: validOutputTokens,
      model_type: modelType
    };
    
    console.log("Insert data for token_usage:", insertData);
    
    const { data, error } = await supabase
      .from('token_usage')
      .insert(insertData)
      .select('id')
      .single();
    
    if (error) {
      console.error("Error tracking token usage:", error);
      throw error;
    }
    
    console.log("Token usage tracked successfully with ID:", data?.id);
    return data;
  } catch (error) {
    console.error("Error in trackTokenUsage:", error);
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
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`
      },
      body: JSON.stringify(payload)
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("API response error:", apiResponse.status, errorText);
      throw new Error(`API error (${apiResponse.status}): ${errorText.substring(0, 200)}`);
    }
    
    return { apiResponse, modelType };
  } catch (error) {
    console.error("API error:", error);
    throw error;
  }
};
