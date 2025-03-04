import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/components/game-chat/types";
import { ModelType } from "@/types/generation";
import { 
  fetchChatHistory, 
  saveMessage, 
  updateMessageResponse, 
  processGameUpdate,
  trackTokenUsage
} from "@/components/game-chat/api-service";
import { 
  updateTerminalOutput, 
  processGroqResponse, 
  processAnthropicStream 
} from "@/components/game-chat/terminal-utils";
import { useAuth } from "@/context/AuthContext";

export interface UseChatMessagesProps {
  gameId: string;
  onGameUpdate: (newCode: string, newInstructions: string) => void;
  onTerminalStatusChange?: (showing: boolean, output: string[], thinking: number, isLoading: boolean) => void;
  initialMessage?: string;
}

export function useChatMessages({
  gameId,
  onGameUpdate,
  onTerminalStatusChange,
  initialMessage
}: UseChatMessagesProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<ModelType>("smart");
  const [initialMessageId, setInitialMessageId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (loading) {
      setThinkingTime(0);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      timerRef.current = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading]);

  useEffect(() => {
    if (onTerminalStatusChange && loading) {
      onTerminalStatusChange(true, terminalOutput, thinkingTime, loading);
    }
  }, [thinkingTime, terminalOutput, loading, onTerminalStatusChange]);

  const fetchMessages = useCallback(async () => {
    if (!gameId) return;
    
    try {
      setLoadingHistory(true);
      console.log("Fetching chat messages for game:", gameId);
      
      const data = await fetchChatHistory(gameId, initialMessage);
      
      const typedData: Message[] = data.map(msg => ({
        ...msg,
        model_type: (msg.model_type as string) === "smart" ? "smart" as ModelType : 
                    (msg.model_type as string) === "fast" ? "fast" as ModelType : null
      }));
      
      if (typedData.length === 1 && typedData[0].id === 'initial-message') {
        setInitialMessageId('initial-message');
      }
      
      console.log(`Loaded ${typedData.length} messages for game ${gameId}`);
      setMessages(typedData);
    } catch (error) {
      console.error("Error loading chat history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [gameId, initialMessage]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const updateTerminalOutputWrapper = (newContent: string, isNewMessage = false) => {
    updateTerminalOutput(setTerminalOutput, newContent, isNewMessage);
  };

  const addSystemMessage = useCallback(async (message: string, response: string) => {
    if (!gameId) return;
    
    try {
      console.log(`Adding system message: ${message}`);
      
      const { data: messageData, error } = await supabase
        .from('game_messages')
        .insert({
          game_id: gameId,
          message,
          response,
          is_system: true
        })
        .select('*')
        .single();
      
      if (error) {
        console.error("Error adding system message:", error);
        return;
      }
      
      if (messageData) {
        console.log("System message added successfully:", messageData.id);
        
        const newMessage: Message = {
          ...messageData,
          model_type: messageData.model_type === "smart" ? "smart" as ModelType : 
                      messageData.model_type === "fast" ? "fast" as ModelType : null
        };
        
        setMessages(prev => [...prev, newMessage]);
        return messageData;
      }
      
    } catch (error) {
      console.error("Error in addSystemMessage:", error);
      throw error;
    }
  }, [gameId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !imageUrl) || loading) return;
    
    setLoading(true);
    setThinkingTime(0);
    
    const initialMessage = `> Processing request: "${message}"${imageUrl ? ' (with image)' : ''}`;
    setTerminalOutput([initialMessage]);
    
    updateTerminalOutputWrapper(`> Using ${modelType === "smart" ? "Anthropic (Smartest)" : "Groq (Fastest)"} model`, true);
    
    if (onTerminalStatusChange) {
      onTerminalStatusChange(true, [initialMessage], 0, true);
    }
    
    const tempId = crypto.randomUUID();
    const tempMessage: Message = {
      id: tempId,
      message: message.trim(),
      created_at: new Date().toISOString(),
      image_url: imageUrl,
      model_type: modelType,
      isLoading: true
    };
    
    setMessages(prev => [...prev, tempMessage]);
    
    const currentMessage = message.trim();
    const currentImageUrl = imageUrl;
    const currentModelType = modelType;
    
    setMessage("");
    setImageUrl(null);
    
    try {
      console.log("Inserting message into database...");
      
      const insertedMessage = await saveMessage(
        gameId, 
        currentMessage, 
        currentModelType, 
        currentImageUrl
      );
      
      console.log("Message inserted successfully:", insertedMessage);
      updateTerminalOutputWrapper("> Message saved successfully", true);
      
      setMessages(prev => 
        prev.map(msg => msg.id === tempId ? {...insertedMessage, isLoading: true} as Message : msg)
      );
      
      console.log("Calling process-game-update function...");
      updateTerminalOutputWrapper("> Sending request to AI...", true);
      
      const { apiResponse, modelType: responseModelType } = await processGameUpdate(
        gameId,
        currentMessage,
        currentModelType,
        currentImageUrl,
        updateTerminalOutputWrapper
      );
      
      console.log("API connection established, processing response...");
      updateTerminalOutputWrapper("> Connection established, receiving content...", true);
      
      let content = '';
      let tokensUsed = 0;
      
      if (responseModelType === "fast") {
        updateTerminalOutputWrapper("> Using non-streaming mode for Groq API...", true);
        
        const responseData = await apiResponse.json();
        console.log("Complete Groq response received:", responseData);
        
        content = await processGroqResponse(responseData, updateTerminalOutputWrapper);
        
        if (responseData.usage) {
          tokensUsed = responseData.usage.total_tokens || 0;
          console.log(`Groq tokens used: ${tokensUsed}`);
        }
      } else {
        const reader = apiResponse.body?.getReader();
        if (!reader) throw new Error("Unable to read response stream");
        
        content = await processAnthropicStream(reader, updateTerminalOutputWrapper);
        
        tokensUsed = Math.ceil((currentMessage.length + content.length) / 4);
        console.log(`Estimated Anthropic tokens used: ${tokensUsed}`);
      }
      
      console.log("Content collection complete. Total length:", content.length);
      
      updateTerminalOutputWrapper("> Processing received content...", true);
      updateTerminalOutputWrapper("> Updating content in the application...", true);
      
      onGameUpdate(content, "Content updated successfully");
      
      await updateMessageResponse(insertedMessage.id, "Content updated successfully");
      
      await trackTokenUsage(
        user?.id,
        gameId,
        insertedMessage.id,
        currentMessage,
        Math.ceil(currentMessage.length / 4),
        tokensUsed,
        currentModelType
      );
      
      updateTerminalOutputWrapper("> Content updated successfully!", true);
      
      const { data: updatedMessages } = await supabase
        .from('game_messages')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });
        
      if (updatedMessages) {
        const typedMessages: Message[] = updatedMessages.map(msg => ({
          ...msg,
          model_type: msg.model_type === "smart" ? "smart" as ModelType : 
                      msg.model_type === "fast" ? "fast" as ModelType : null
        }));
        
        setMessages(typedMessages);
      }
      
      if (onTerminalStatusChange) {
        setTimeout(() => {
          onTerminalStatusChange(false, [], 0, false);
        }, 3000);
      }
      
      addSystemMessage(
        "Update complete", 
        "✅ Content updated successfully! The changes have been applied."
      );
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      
      updateTerminalOutputWrapper(
        `> Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true
      );
      
      addSystemMessage(
        "Error", 
        `❌ Error processing message: ${error instanceof Error ? error.message : "Please try again"}`
      );
      
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      if (onTerminalStatusChange) {
        setTimeout(() => {
          onTerminalStatusChange(false, [], 0, false);
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (value: string) => {
    setModelType(value as ModelType);
  };

  return {
    message,
    setMessage,
    messages,
    loading,
    loadingHistory,
    imageUrl,
    setImageUrl,
    modelType,
    handleModelChange,
    handleSubmit,
    initialMessageId,
    setInitialMessageId,
    terminalOutput,
    addSystemMessage,
    fetchMessages
  };
}
