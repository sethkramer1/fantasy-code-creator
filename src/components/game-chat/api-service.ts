
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

export const processGameUpdate = async (
  gameId: string,
  message: string,
  modelType: string,
  imageUrl?: string,
  updateTerminalOutput?: (text: string, isNewMessage?: boolean) => void
) => {
  try {
    const payload: {
      gameId: string;
      message: string;
      modelType: string;
      imageUrl?: string;
      stream?: boolean;
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
