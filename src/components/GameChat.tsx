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
          // Fix line 88 by adding explicit type assertion
          const { data: updateResult, error: rpcError } = await supabase
            .rpc('update_initial_generation_message', { game_id_param: gameId }) as {
              data: boolean | null;
              error: any;
            };
            
          if (rpcError) {
            console.error("Error calling update_initial_generation_message:", rpcError);
          } else {
            console.log("Initial generation message update result:", updateResult);
          }
          
          // Fix for line 96 with explicit type assertion
          const { data: existingMessages, error: checkError } = await supabase
            .from('game_messages')
            .select('id, response')
            .eq('game_id', gameId)
            .eq('is_system', true)
            .eq('message', 'Initial generation complete')
            .limit(1) as {
              data: Array<{ id: string; response: string | null }> | null;
              error: any;
            };
            
          if (checkError) {
            console.error("Error checking for existing completion message:", checkError);
          } else if (existingMessages && existingMessages.length > 0) {
            console.log("Completion message already exists, skipping:", existingMessages[0]);
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === existingMessages[0].id ? { ...msg, response: existingMessages[0].response } : msg
              )
            );
            initialMessageCompletedRef.current = true;
            return;
          }
          
          if (!initialMessageCompletedRef.current) {
            await addSystemMessage(
              "Initial generation complete",
              "✅ Content generated successfully! You can now ask me to modify the content or add new features."
            );
            initialMessageCompletedRef.current = true;
          }
          
          setGenerationComplete(false);
          
          await fetchMessages();
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
        initialMessageCompletedRef.current = false;
      }
    };
  }, [generationComplete, gameId, addSystemMessage, fetchMessages, setMessages]);

  
  useEffect(() => {
    const ensureWelcomeMessage = async () => {
      if (!disabled && !loadingHistory && messages.length === 0 && gameId) {
        console.log("No messages found after load, adding welcome message");
        try {
          const { data: existingMessages, error: checkError } = await supabase
            .from('game_messages')
            .select('id')
            .eq('game_id', gameId)
            .eq('is_system', true)
            .eq('message', 'Welcome')
            .limit(1) as {
              data: Array<{ id: string }> | null;
              error: any;
            };
            
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
