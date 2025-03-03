
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Message } from "@/components/game-chat/types";
import { ModelType } from "@/types/generation";
import { 
  fetchChatHistory, 
  saveMessage, 
  updateMessageResponse, 
  processGameUpdate 
} from "@/components/game-chat/api-service";
import { 
  updateTerminalOutput, 
  processGroqResponse, 
  processAnthropicStream 
} from "@/components/game-chat/terminal-utils";

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
  const { toast } = useToast();

  // Initialize timer for thinking time
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

  // Update terminal status
  useEffect(() => {
    if (onTerminalStatusChange && loading) {
      onTerminalStatusChange(true, terminalOutput, thinkingTime, loading);
    }
  }, [thinkingTime, terminalOutput, loading, onTerminalStatusChange]);

  // Load chat history
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const data = await fetchChatHistory(gameId, initialMessage);
        
        // Convert model_type from string to ModelType
        const typedData: Message[] = data.map(msg => ({
          ...msg,
          model_type: (msg.model_type as string) === "smart" ? "smart" as ModelType : 
                      (msg.model_type as string) === "fast" ? "fast" as ModelType : null
        }));
        
        if (typedData.length === 1 && typedData[0].id === 'initial-message') {
          setInitialMessageId('initial-message');
        }
        
        setMessages(typedData);
      } catch (error) {
        toast({
          title: "Error loading chat history",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive"
        });
      } finally {
        setLoadingHistory(false);
      }
    };
    
    loadChatHistory();
  }, [gameId, toast, initialMessage]);

  const updateTerminalOutputWrapper = (newContent: string, isNewMessage = false) => {
    updateTerminalOutput(setTerminalOutput, newContent, isNewMessage);
  };

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
      
      if (responseModelType === "fast") {
        updateTerminalOutputWrapper("> Using non-streaming mode for Groq API...", true);
        
        const responseData = await apiResponse.json();
        console.log("Complete Groq response received:", responseData);
        
        content = await processGroqResponse(responseData, updateTerminalOutputWrapper);
      } else {
        const reader = apiResponse.body?.getReader();
        if (!reader) throw new Error("Unable to read response stream");
        
        content = await processAnthropicStream(reader, updateTerminalOutputWrapper);
      }
      
      console.log("Content collection complete. Total length:", content.length);
      
      updateTerminalOutputWrapper("> Processing received content...", true);
      updateTerminalOutputWrapper("> Updating content in the application...", true);
      
      onGameUpdate(content, "Content updated successfully");
      
      await updateMessageResponse(insertedMessage.id, "Content updated successfully");
      
      updateTerminalOutputWrapper("> Content updated successfully!", true);
      
      const { data: updatedMessages } = await supabase
        .from('game_messages')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });
        
      if (updatedMessages) {
        // Convert model_type from string to ModelType
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
      
      toast({
        title: "Content updated successfully",
        description: "The changes have been applied successfully."
      });
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      
      updateTerminalOutputWrapper(
        `> Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true
      );
      
      toast({
        title: "Error processing message",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
      
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
    terminalOutput
  };
}
