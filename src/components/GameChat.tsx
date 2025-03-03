
import { useEffect, useRef, useState } from "react";
import { MessageList } from "./game-chat/MessageList";
import { ChatInput } from "./game-chat/ChatInput";
import { GameChatProps } from "./game-chat/types";
import { useChatMessages } from "@/hooks/useChatMessages";

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
    }
    
    // Update previous disabled state for next comparison
    setPreviousDisabledState(disabled);
  }, [disabled, initialMessageId, previousDisabledState, setInitialMessageId]);

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
