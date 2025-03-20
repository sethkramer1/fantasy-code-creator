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

  // Add confirmation message after generation completes and clean up status messages
  useEffect(() => {
    const handleGenerationComplete = async () => {
      if (generationComplete && gameId && !generationHandledRef.current) {
        generationHandledRef.current = true;
        console.log("Adding confirmation message after generation");
        
        try {
          // First, clean up any existing status messages to prevent duplicates
          const { data: allMessages } = await supabase
            .from('game_messages')
            .select('*')
            .eq('game_id', gameId)
            .order('created_at', { ascending: true });
            
          if (allMessages) {
            // Find all status-related messages
            const statusMessages = allMessages.filter(msg => 
              (msg.is_system && 
               (msg.message === "Initial generation complete" || 
                msg.message === "Welcome" || 
                msg.message === "Generation Complete" ||
                msg.message === "Initial Generation" ||
                msg.message === "Content generated")) ||
              (msg.message && msg.message.includes("Generating initial")) ||
              (msg.response === "Generating initial content...") ||
              (msg.response === "Initial generation in progress...")
            );
            
            console.log(`Found ${statusMessages.length} status messages to clean up`);
            
            // Delete all status messages except one that we will update
            let initialMessageToUpdate = null;
            for (const msg of statusMessages) {
              // Keep only one message to update if it's an initial generation message
              if ((msg.response === "Initial generation in progress..." || 
                   msg.response === "Generating initial content...") && 
                   !initialMessageToUpdate) {
                console.log(`Keeping and updating initial message: ${msg.id}`);
                initialMessageToUpdate = msg;
                continue;
              }
              
              console.log(`Deleting status message: ${msg.id}, content: ${msg.message}`);
              await supabase
                .from('game_messages')
                .delete()
                .eq('id', msg.id);
            }

            // If we found an initial message to update, update it
            if (initialMessageToUpdate) {
              const { data: updatedMessage, error: updateError } = await supabase
                .from('game_messages')
                .update({ 
                  response: "✅ Content has been generated successfully. You can now ask me to modify it!" 
                })
                .eq('id', initialMessageToUpdate.id)
                .select('*')
                .maybeSingle();
                
              if (updateError) {
                console.error("Error updating initial generation message:", updateError);
              } else if (updatedMessage) {
                console.log("Successfully updated initial message:", updatedMessage.id);
                
                // Update the message in the local state
                setMessages(prevMessages => 
                  prevMessages.map(msg => 
                    msg.id === initialMessageToUpdate.id
                      ? { ...msg, response: "✅ Content has been generated successfully. You can now ask me to modify it!" } 
                      : msg
                  )
                );
              }
            } else {
              // If no initial message found, add a new completion message
              const { data: newMessage, error: insertError } = await supabase
                .from('game_messages')
                .insert({
                  game_id: gameId,
                  message: "Generation Complete",
                  response: "✅ Content has been generated successfully. You can now ask me to modify it!",
                  is_system: true
                })
                .select('*')
                .single();
                
              if (insertError) {
                console.error("Error adding completion message:", insertError);
              } else if (newMessage) {
                console.log("Added new completion message:", newMessage.id);
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
