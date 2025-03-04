import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ModelType } from "@/types/generation";
import { saveGeneratedGame } from "@/services/generation/gameStorageService";
import { useAuth } from "@/context/AuthContext";
import { updateTerminalOutput, processAnthropicStream } from "@/components/game-chat/terminal-utils";
import { trackTokenUsage } from "@/components/game-chat/api-service";
import { saveInitialGenerationTokens, updateTokenCounts } from "@/services/generation/tokenTrackingService";

interface TerminalState {
  generationInProgress: boolean;
  terminalOutput: string[];
  showTerminal: boolean;
  thinkingTime: number;
  generationComplete: boolean;
  generationError: string | null;
}

export function usePlayTerminal(
  gameId: string | undefined,
  generating: boolean,
  initialPrompt: string,
  gameType: string,
  modelType: string = "smart",
  imageUrl: string = ""
) {
  const [state, setState] = useState<TerminalState>({
    generationInProgress: generating,
    terminalOutput: [],
    showTerminal: generating,
    thinkingTime: 0,
    generationComplete: false,
    generationError: null
  });
  
  const timerRef = useRef<NodeJS.Timeout | undefined>();
  const isInitialMount = useRef(true);
  const { user } = useAuth();
  const retryCount = useRef(0);
  const maxRetries = 2;
  const gameContentRef = useRef<string>('');

  const setShowTerminal = (show: boolean) => {
    setState(prev => ({ ...prev, showTerminal: show }));
  };

  const handleTerminalStatusChange = (
    showing: boolean,
    output: string[],
    thinking: number,
    isLoading: boolean
  ) => {
    setState(prev => ({
      ...prev,
      showTerminal: showing,
      terminalOutput: output,
      thinkingTime: thinking,
      generationInProgress: isLoading
    }));
  };

  const updateTerminalOutputWrapper = (newOutput: string, isNewMessage = false) => {
    setState(prev => {
      let updatedOutput: string[];
      
      if (isNewMessage || 
          newOutput.startsWith("> Thinking:") || 
          newOutput.startsWith("> Generation") || 
          newOutput.includes("completed") || 
          newOutput.includes("Error:")) {
        updatedOutput = [...prev.terminalOutput, newOutput];
      } else {
        if (prev.terminalOutput.length > 0) {
          const lastLine = prev.terminalOutput[prev.terminalOutput.length - 1];
          
          if (lastLine.startsWith("> ") && !lastLine.startsWith("> Thinking:") && 
              newOutput.startsWith("> ") && !newOutput.startsWith("> Thinking:")) {
            
            const updatedLastLine = lastLine + newOutput.slice(1);
            updatedOutput = [...prev.terminalOutput.slice(0, -1), updatedLastLine];
          } else {
            updatedOutput = [...prev.terminalOutput, newOutput];
          }
        } else {
          updatedOutput = [newOutput];
        }
      }
      
      return {
        ...prev,
        terminalOutput: updatedOutput
      };
    });
  };

  useEffect(() => {
    if (state.generationInProgress) {
      setState(prev => ({ ...prev, thinkingTime: 0 }));
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
      
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, thinkingTime: prev.thinkingTime + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [state.generationInProgress]);

  const makeApiCallWithRetry = async () => {
    try {
      updateTerminalOutputWrapper(`> Attempt ${retryCount.current + 1} to generate content...`, true);
      
      console.log("Starting generation process for gameId:", gameId);
      console.log("Using prompt:", initialPrompt);
      
      if (!initialPrompt || initialPrompt === "Loading...") {
        throw new Error("Invalid prompt: The prompt is empty or still showing 'Loading...'");
      }
      
      const payload = {
        gameId,
        prompt: initialPrompt,
        gameType,
        modelType: modelType as ModelType,
        imageUrl: imageUrl || undefined,
        stream: modelType === "smart",
        userId: user?.id,
        thinking: modelType === "smart" ? {
          type: "enabled",
          budget_tokens: 10000
        } : undefined
      };
      
      const apiUrl = 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game';
      
      console.log("Calling generate-game function with payload:", {
        gameIdLength: gameId?.length,
        promptLength: initialPrompt.length,
        promptContent: initialPrompt.substring(0, 50) + "...",
        gameType,
        modelType,
        hasImage: !!imageUrl,
        hasUserId: !!user?.id
      });
      
      updateTerminalOutputWrapper("> Connecting to AI service...", true);
      updateTerminalOutputWrapper(`> Using prompt: "${initialPrompt}"`, true);
      
      gameContentRef.current = '';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(180000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        throw new Error(`API error (${response.status}): ${errorText.substring(0, 200)}`);
      }
      
      updateTerminalOutputWrapper("> Connection established, receiving content...", true);
      
      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let tokenInfoExtracted = false;
      let initialMessageId = '';
      
      const { data: messageData, error: messageError } = await supabase
        .from('game_messages')
        .insert({
          game_id: gameId,
          message: "Initial Generation",
          response: "Processing initial content...",
          is_system: true,
          model_type: modelType
        })
        .select('id')
        .single();
        
      if (messageError) {
        console.error("Error creating initial message:", messageError);
      } else if (messageData?.id) {
        initialMessageId = messageData.id;
        console.log("Created initial message for token tracking:", initialMessageId);
        
        const estimatedInputTokens = Math.ceil(initialPrompt.length / 4);
        const estimatedOutputTokens = 1;
        
        const { data: tokenData, error: tokenError } = await supabase
          .from('token_usage')
          .insert({
            user_id: user?.id,
            game_id: gameId,
            message_id: initialMessageId,
            prompt: initialPrompt.substring(0, 5000),
            input_tokens: estimatedInputTokens,
            output_tokens: estimatedOutputTokens,
            model_type: modelType
          })
          .select('id')
          .single();
          
        if (tokenError) {
          console.error("Error creating initial token record:", tokenError);
        } else {
          console.log("Created initial token record:", tokenData.id);
        }
      }
      
      if (modelType === "smart" && response.body) {
        const reader = response.body.getReader();
        updateTerminalOutputWrapper("> Stream connected, processing real-time content...", true);
        content = await processAnthropicStream(reader, updateTerminalOutputWrapper);
        
        const usageMatch = content.match(/Tokens used: (\d+) input, (\d+) output/);
        if (usageMatch) {
          inputTokens = parseInt(usageMatch[1], 10);
          outputTokens = parseInt(usageMatch[2], 10);
          tokenInfoExtracted = true;
          updateTerminalOutputWrapper(`> Token usage: ${inputTokens} input, ${outputTokens} output tokens`, true);
          console.log("Extracted token usage from stream:", inputTokens, outputTokens);
        } else {
          inputTokens = Math.ceil(initialPrompt.length / 4);
          outputTokens = Math.ceil(content.length / 4);
          updateTerminalOutputWrapper(`> Estimated token usage: ${inputTokens} input, ${outputTokens} output tokens`, true);
          console.log("Using estimated token usage:", inputTokens, outputTokens);
        }
      } else {
        const data = await response.json();
        console.log("Non-streaming response received:", {
          hasContent: !!data.content,
          contentLength: data.content?.length || 0,
          tokenInfo: data.tokenInfo || 'Not provided',
          usage: data.usage || 'Not provided'
        });
        
        if (!data.content || data.content.length < 100) {
          throw new Error("Received empty or invalid content from generation");
        }
        
        content = data.content;
        
        if (data.usage) {
          if (data.usage.input_tokens && data.usage.output_tokens) {
            inputTokens = data.usage.input_tokens;
            outputTokens = data.usage.output_tokens;
            tokenInfoExtracted = true;
            console.log("Using Anthropic token usage data:", inputTokens, outputTokens);
          } else if (data.usage.prompt_tokens && data.usage.completion_tokens) {
            inputTokens = data.usage.prompt_tokens;
            outputTokens = data.usage.completion_tokens;
            tokenInfoExtracted = true;
            console.log("Using Groq token usage data:", inputTokens, outputTokens);
          }
          
          if (tokenInfoExtracted) {
            updateTerminalOutputWrapper(`> Token usage: ${inputTokens} input, ${outputTokens} output tokens`, true);
          }
        } else if (data.tokenInfo) {
          inputTokens = data.tokenInfo.inputTokens || Math.ceil(initialPrompt.length / 4);
          outputTokens = data.tokenInfo.outputTokens || Math.ceil(content.length / 4);
          tokenInfoExtracted = true;
          updateTerminalOutputWrapper(`> Token usage: ${inputTokens} input, ${outputTokens} output tokens`, true);
          console.log("Using tokenInfo data:", inputTokens, outputTokens);
        }
        
        if (!tokenInfoExtracted) {
          inputTokens = Math.ceil(initialPrompt.length / 4);
          outputTokens = Math.ceil(content.length / 4);
          updateTerminalOutputWrapper(`> Estimated token usage: ${inputTokens} input, ${outputTokens} output tokens`, true);
          console.log("Using estimated token usage:", inputTokens, outputTokens);
        }
        
        updateTerminalOutputWrapper("> Content received successfully", true);
      }
      
      if (gameContentRef.current && gameContentRef.current.length > 100) {
        content = gameContentRef.current;
      }
      
      if (!content || content.length < 100) {
        throw new Error("Received empty or invalid content from generation");
      }
      
      if (initialMessageId && tokenInfoExtracted) {
        const updated = await updateTokenCounts(initialMessageId, inputTokens, outputTokens);
        if (updated) {
          updateTerminalOutputWrapper("> Token usage updated with actual counts", true);
          console.log("Token usage updated with actual counts");
        }
      } else if (gameId) {
        try {
          const result = await trackTokenUsage(
            user?.id,
            gameId,
            initialMessageId || `generation-${gameId}`,
            initialPrompt,
            inputTokens,
            outputTokens,
            modelType
          );
          
          if (result) {
            updateTerminalOutputWrapper("> Token usage tracked successfully", true);
            console.log("Token usage tracked successfully with ID:", result.id);
          } else {
            updateTerminalOutputWrapper("> Warning: Token usage tracking failed", true);
          }
        } catch (error) {
          console.error("Error tracking token usage:", error);
          updateTerminalOutputWrapper(`> Warning: Failed to track token usage: ${error.message}`, true);
        }
      }
      
      updateTerminalOutputWrapper("> Processing and saving generated content...", true);
      
      const modelTypeForSave = modelType === "smart" ? "smart" : "fast";
      
      const { error: gameUpdateError } = await supabase
        .from('games')
        .update({
          code: content,
          instructions: "Initial content generated successfully",
          model_type: modelTypeForSave,
          prompt: initialPrompt
        })
        .eq('id', gameId);
        
      if (gameUpdateError) {
        console.error("Error updating game:", gameUpdateError);
        throw new Error(`Database error: ${gameUpdateError.message}`);
      }
      
      const { error: versionUpdateError } = await supabase
        .from('game_versions')
        .update({
          code: content,
          instructions: "Initial content generated successfully"
        })
        .eq('game_id', gameId)
        .eq('version_number', 1);
        
      if (versionUpdateError) {
        console.error("Error updating game version:", versionUpdateError);
        throw new Error(`Database error: ${versionUpdateError.message}`);
      }
      
      updateTerminalOutputWrapper("> Content saved successfully", true);
      
      if (initialMessageId) {
        const { error: messageUpdateError } = await supabase
          .from('game_messages')
          .update({ response: "Initial content generated successfully" })
          .eq('id', initialMessageId);
          
        if (messageUpdateError) {
          console.error("Error updating initial message:", messageUpdateError);
        }
      } else {
        await supabase
          .from('game_messages')
          .update({ response: "Initial content generated successfully" })
          .eq('game_id', gameId)
          .is('response', null);
      }
        
      console.log("Generation completed successfully");
      
      retryCount.current = 0;
    } catch (error) {
      console.error(`Generation attempt ${retryCount.current + 1} failed:`, error);
      updateTerminalOutputWrapper(`> Error: ${error.message}`, true);
      
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        updateTerminalOutputWrapper(`> Retrying generation (attempt ${retryCount.current} of ${maxRetries})...`, true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return makeApiCallWithRetry();
      } else {
        throw error;
      }
    }
  };

  useEffect(() => {
    const generateInitialContent = async () => {
      if (!gameId || !generating || !isInitialMount.current) {
        return;
      }
      
      isInitialMount.current = false;
      
      try {
        setState(prev => ({ 
          ...prev, 
          generationInProgress: true,
          terminalOutput: ["Starting initial generation..."],
          showTerminal: true,
          generationError: null
        }));
        
        updateTerminalOutputWrapper(`> Processing request: "${initialPrompt}"${imageUrl ? ' (with image)' : ''}`, true);
        updateTerminalOutputWrapper(`> Using ${modelType === "smart" ? "Anthropic (Smartest)" : "Groq (Fastest)"} model`, true);
        
        retryCount.current = 0;
        
        await makeApiCallWithRetry();
        
        setState(prev => ({ 
          ...prev, 
          generationInProgress: false,
          generationComplete: true
        }));
        
        setTimeout(() => {
          setState(prev => ({ ...prev, showTerminal: false }));
          
          Promise.resolve(
            supabase
              .from('game_messages')
              .insert({
                game_id: gameId,
                message: "Generation Complete",
                response: "✅ Content has been generated successfully. You can now ask me to modify it!",
                is_system: true
              })
          )
            .then(() => {
              console.log("Added system message about successful generation (terminal effect)");
            })
            .catch(error => {
              console.error("Error adding system message:", error);
            });
        }, 1500);
        
      } catch (error) {
        console.error("Error in generateInitialContent:", error);
        
        updateTerminalOutputWrapper(`> Fatal Error: ${error.message}`, true);
        updateTerminalOutputWrapper(`> Generation failed after ${retryCount.current} retries`, true);
        
        setState(prev => ({ 
          ...prev, 
          generationInProgress: false,
          generationError: error.message
        }));
        
        Promise.resolve(
          supabase
            .from('game_messages')
            .insert({
              game_id: gameId,
              message: "Generation Error",
              response: `❌ ${error.message || "Failed to generate content"}${gameContentRef.current.length > 500 ? " (partial content may be available)" : ""}`,
              is_system: true
            })
        )
          .then(() => {
            console.log("Added system message about generation error");
          })
          .catch(err => {
            console.error("Error adding system message:", err);
          });
      }
    };
    
    generateInitialContent();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [gameId, generating, initialPrompt, gameType, modelType, imageUrl, user]);

  return {
    generationInProgress: state.generationInProgress,
    terminalOutput: state.terminalOutput,
    showTerminal: state.showTerminal,
    thinkingTime: state.thinkingTime,
    handleTerminalStatusChange,
    setShowTerminal,
    generationError: state.generationError
  };
}
