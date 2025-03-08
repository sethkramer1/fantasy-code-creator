
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
  const initialMessageCompletedRef = useRef<boolean>(false);
  
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
    const addConfirmationMessage = async () => {
      if (generationComplete && gameId && !generationHandledRef.current) {
        generationHandledRef.current = true;
        console.log("Adding confirmation message after generation");
        
        try {
          // Correct way to call an RPC function
          const { data: updateResult, error: rpcError } = await supabase
            .rpc('update_initial_generation_message', { game_id_param: gameId });
            
          if (rpcError) {
            console.error("Error calling update_initial_generation_message:", rpcError);
          } else {
            console.log("Initial generation message update result:", updateResult);
          }
          
          // Check if we've already added a completion message to avoid duplicates
          const { data: existingMessages, error: checkError } = await supabase
            .from('game_messages')
            .select('id, response')
            .eq('game_id', gameId)
            .eq('is_system', true)
            .eq('message', 'Initial generation complete')
            .limit(1);
            
          if (checkError) {
            console.error("Error checking for existing completion message:", checkError);
          } else if (existingMessages && existingMessages.length > 0) {
            console.log("Completion message already exists, skipping:", existingMessages[0]);
            // Update the message in the local state
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === existingMessages[0].id ? { ...msg, response: existingMessages[0].response } : msg
              )
            );
            initialMessageCompletedRef.current = true;
            return;
          }
          
          // Only create the completion message if it doesn't exist yet
          if (!initialMessageCompletedRef.current) {
            await addSystemMessage(
              "Initial generation complete",
              "✅ Content generated successfully! You can now ask me to modify the content or add new features."
            );
            initialMessageCompletedRef.current = true;
          }
          
          // Reset the flag
          setGenerationComplete(false);
          
          // Force a message fetch to ensure we have the latest messages
          await fetchMessages();
        } catch (error) {
          console.error("Error adding confirmation message:", error);
          // Reset the ref so we can try again
          generationHandledRef.current = false;
        }
      }
    };
    
    addConfirmationMessage();
    
    // Reset the handled ref when game ID changes
    return () => {
      if (gameId !== undefined) {
        generationHandledRef.current = false;
        initialMessageCompletedRef.current = false;
      }
    };
  }, [generationComplete, gameId, addSystemMessage, fetchMessages, setMessages]);

  // Additional check to add a welcome message if none exists and generation is complete
  useEffect(() => {
    const ensureWelcomeMessage = async () => {
      // Only run this once when loading is complete and messages are loaded
      if (!disabled && !loadingHistory && messages.length === 0 && gameId) {
        console.log("No messages found after load, adding welcome message");
        try {
          // Check if we've already added a welcome message to avoid duplicates
          const { data: existingMessages, error: checkError } = await supabase
            .from('game_messages')
            .select('id')
            .eq('game_id', gameId)
            .eq('is_system', true)
            .eq('message', 'Welcome')
            .limit(1);
            
          if (checkError) {
            console.error("Error checking for existing welcome message:", checkError);
          } else if (existingMessages && existingMessages.length > 0) {
            console.log("Welcome message already exists, skipping");
            return;
          }
          
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
