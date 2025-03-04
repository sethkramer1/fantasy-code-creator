import { useEffect, useRef, useState } from "react";
import { MessageList } from "./game-chat/MessageList";
import { ChatInput } from "./game-chat/ChatInput";
import { GameChatProps } from "./game-chat/types";
import { useChatMessages } from "@/hooks/useChatMessages";
import { supabase } from "@/integrations/supabase/client";

export const GameChat = ({
  gameId,
  onGameUpdate,
  onTerminalStatusChange,
  disabled = false,
  onRevertToVersion,
  gameVersions = [],
  initialMessage,
  modelType = "smart",
  gameUserId
}: GameChatProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previousDisabledState, setPreviousDisabledState] = useState<boolean>(disabled);
  const [generationComplete, setGenerationComplete] = useState<boolean>(false);
  const generationHandledRef = useRef<boolean>(false);
  
  const {
    message,
    setMessage,
    messages,
    loading,
    loadingHistory,
    imageUrl,
    setImageUrl,
    modelType: currentModelType,
    handleModelChange,
    handleSubmit,
    initialMessageId,
    setInitialMessageId,
    addSystemMessage,
    fetchMessages
  } = useChatMessages({
    gameId,
    onGameUpdate,
    onTerminalStatusChange,
    initialMessage,
    modelType
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (previousDisabledState === true && disabled === false) {
      console.log("Generation state changed from in-progress to complete");
      if (initialMessageId) {
        setInitialMessageId(null);
        setGenerationComplete(true);
      }
    }
    
    setPreviousDisabledState(disabled);
  }, [disabled, initialMessageId, previousDisabledState, setInitialMessageId]);

  useEffect(() => {
    const addConfirmationMessage = async () => {
      if (generationComplete && gameId && !generationHandledRef.current) {
        generationHandledRef.current = true;
        console.log("Adding confirmation message after generation");
        
        try {
          await addSystemMessage(
            "Initial generation complete",
            "✅ Content generated successfully! You can now ask me to modify the content or add new features."
          );
          
          await fetchMessages();
          
          setGenerationComplete(false);
        } catch (error) {
          console.error("Error adding confirmation message:", error);
          generationHandledRef.current = false;
        }
      }
    };
    
    addConfirmationMessage();
    
    return () => {
      if (gameId !== undefined) {
        generationHandledRef.current = false;
      }
    };
  }, [generationComplete, gameId, addSystemMessage, fetchMessages]);

  useEffect(() => {
    const ensureWelcomeMessage = async () => {
      if (!disabled && !loadingHistory && messages.length === 0 && gameId) {
        console.log("No messages found after load, adding welcome message");
        try {
          await addSystemMessage(
            "Welcome",
            "✅ Your content is ready! You can now ask me to modify it or add new features."
          );
          await fetchMessages();
        } catch (error) {
          console.error("Error adding welcome message:", error);
        }
      }
    };
    
    ensureWelcomeMessage();
  }, [disabled, loadingHistory, messages.length, gameId, addSystemMessage, fetchMessages]);

  return (
    <div className="flex flex-col h-full w-full max-w-[400px] mx-auto bg-white">
      <MessageList 
        messages={messages}
        loadingHistory={loadingHistory}
        onRevertToVersion={onRevertToVersion}
        gameVersions={gameVersions}
        ref={messagesEndRef}
        gameUserId={gameUserId}
      />
      
      <ChatInput 
        message={message}
        setMessage={setMessage}
        imageUrl={imageUrl}
        setImageUrl={setImageUrl}
        modelType={currentModelType}
        handleModelChange={handleModelChange}
        handleSubmit={handleSubmit}
        loading={loading}
        disabled={disabled}
      />
    </div>
  );
};
