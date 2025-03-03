
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
  initialMessage
}: GameChatProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previousDisabledState, setPreviousDisabledState] = useState<boolean>(disabled);
  const [generationComplete, setGenerationComplete] = useState<boolean>(false);
  
  const {
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
    setInitialMessageId
  } = useChatMessages({
    gameId,
    onGameUpdate,
    onTerminalStatusChange,
    initialMessage
  });

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle generation completion
  useEffect(() => {
    // Check if disabled state changed from true to false (generation completed)
    if (previousDisabledState === true && disabled === false && initialMessageId === 'initial-message') {
      // Update the message to show content was generated successfully
      setInitialMessageId(null);
      setGenerationComplete(true);
    }
    
    // Update previous disabled state for next comparison
    setPreviousDisabledState(disabled);
  }, [disabled, initialMessageId, previousDisabledState, setInitialMessageId]);

  // Add confirmation message after generation completes
  useEffect(() => {
    const addConfirmationMessage = async () => {
      if (generationComplete && gameId) {
        // Check if there are only initial messages
        const hasOnlyInitialMessage = messages.length === 1 && messages[0].id === 'initial-message';
        
        if (hasOnlyInitialMessage) {
          try {
            // Add a confirmation message from the system
            await supabase
              .from('game_messages')
              .insert({
                game_id: gameId,
                message: "Initial generation complete",
                response: "Content generated successfully. You can now ask me to modify the content!",
                is_system: true
              });
              
            // Reset the flag
            setGenerationComplete(false);
          } catch (error) {
            console.error("Error adding confirmation message:", error);
          }
        }
      }
    };
    
    addConfirmationMessage();
  }, [generationComplete, gameId, messages]);

  return (
    <div className="flex flex-col h-full w-full max-w-[400px] mx-auto bg-white">
      <MessageList 
        messages={messages}
        loadingHistory={loadingHistory}
        onRevertToVersion={onRevertToVersion}
        gameVersions={gameVersions}
        ref={messagesEndRef}
      />
      
      <ChatInput 
        message={message}
        setMessage={setMessage}
        imageUrl={imageUrl}
        setImageUrl={setImageUrl}
        modelType={modelType}
        handleModelChange={handleModelChange}
        handleSubmit={handleSubmit}
        loading={loading}
        disabled={disabled}
      />
    </div>
  );
};
