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
  disabledMessage,
  onRevertToVersion,
  gameVersions = [],
  initialMessage,
  modelType = "smart"
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
    fetchMessages,
    setMessages
  } = useChatMessages({
    gameId,
    onGameUpdate,
    onTerminalStatusChange,
    initialMessage,
    modelType
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
    if (previousDisabledState === true && disabled === false) {
      console.log("Generation state changed from in-progress to complete");
      if (initialMessageId) {
        setInitialMessageId(null);
        setGenerationComplete(true);
      }
    }
    
    // Update previous disabled state for next comparison
    setPreviousDisabledState(disabled);
  }, [disabled, initialMessageId, previousDisabledState, setInitialMessageId]);

  // Add confirmation message after generation completes
  useEffect(() => {
    const handleGenerationComplete = async () => {
      if (generationComplete && gameId && !generationHandledRef.current) {
        generationHandledRef.current = true;
        console.log("Adding confirmation message after generation");
        
        try {
          // Update the initial generation message to show completion
          const { data: updatedMessage, error: updateError } = await supabase
            .from('game_messages')
            .update({ response: "✅ Content generated successfully! The game has been updated successfully." })
            .eq('game_id', gameId)
            .eq('response', "Initial generation in progress...")
            .select('*')
            .single();
            
          if (updateError) {
            console.error("Error updating initial generation message:", updateError);
          } else if (updatedMessage) {
            // Update the message in the local state
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.response === "Initial generation in progress..." ? { ...msg, response: "✅ Content generated successfully! The game has been updated successfully." } : msg
              )
            );
            
            // Clean up any duplicate or interim status messages
            const { data: existingMessages } = await supabase
              .from('game_messages')
              .select('*')
              .eq('game_id', gameId)
              .order('created_at', { ascending: true });
              
            if (existingMessages) {
              const statusMessages = existingMessages.filter(
                msg => (msg.is_system && 
                      (msg.message === "Initial generation complete" || 
                       msg.message === "Welcome" || 
                       msg.message === "Generation Complete" ||
                       msg.message === "Content generated"))
              );
              
              // If we have multiple status messages, keep only the initial message we just updated
              if (statusMessages.length > 0) {
                console.log(`Found ${statusMessages.length} status messages, cleaning up duplicates`);
                for (const msg of statusMessages) {
                  await supabase
                    .from('game_messages')
                    .delete()
                    .eq('id', msg.id);
                }
              }
            }
          }
          
          // Reset the flag and fetch latest messages
          setGenerationComplete(false);
          await fetchMessages();
        } catch (error) {
          console.error("Error handling generation completion:", error);
          // Reset the ref so we can try again
          generationHandledRef.current = false;
        }
      }
    };
    
    handleGenerationComplete();
    
    // Reset the handled ref when game ID changes
    return () => {
      if (gameId !== undefined) {
        generationHandledRef.current = false;
      }
    };
  }, [generationComplete, gameId, addSystemMessage, fetchMessages, setMessages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-gray-400">Loading conversation...</div>
          </div>
        ) : (
          <MessageList 
            messages={messages} 
            onRevertToVersion={onRevertToVersion}
            gameVersions={gameVersions}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
      
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
        disabledMessage={disabledMessage}
      />
    </div>
  );
};
