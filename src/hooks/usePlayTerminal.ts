import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ModelType, StreamEvent } from "@/types/generation";
import { saveGeneratedGame } from "@/services/generation/gameStorageService";
import { useAuth } from "@/context/AuthContext";
import { updateTerminalOutput, processAnthropicStream } from "@/components/game-chat/terminal-utils";
import { trackTokenUsage } from "@/components/game-chat/api-service";
import { saveInitialGenerationTokens, updateTokenCounts, forceTokenTracking } from "@/services/generation/tokenTrackingService";
import { generateGameName } from "@/services/generation/anthropicService";

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
  const terminationTriggeredRef = useRef(false);
  const initialGenerationCompleteRef = useRef(false);
  const tokenTrackingAttemptedRef = useRef(false);
  const inputTokensRef = useRef(0);
  const outputTokensRef = useRef(0);
  const messageIdRef = useRef('');
  const tokenTrackingAttemptsRef = useRef(0);
  const maxTokenTrackingAttempts = 3;
  const forceTokenTrackingExecutedRef = useRef(false);
  const versionCreationInProgressRef = useRef(false);

  const setShowTerminal = (show: boolean) => {
    setState(prev => ({ ...prev, showTerminal: show }));
    
    console.log("[TOKEN TRACKING] Terminal visibility changed:", {
      show,
      initialGenerationComplete: initialGenerationCompleteRef.current,
      terminationTriggered: terminationTriggeredRef.current,
      gameId,
      inputTokens: inputTokensRef.current,
      outputTokens: outputTokensRef.current,
      trackingAttempts: tokenTrackingAttemptsRef.current
    });
    
    if (!show && initialGenerationCompleteRef.current && !terminationTriggeredRef.current && gameId) {
      console.log("[TOKEN TRACKING] Terminal hidden after initial generation - triggering final token tracking");
      terminationTriggeredRef.current = true;
      
      setTimeout(() => {
        ensureFinalTokenTracking(gameId);
      }, 500);
    }
  };
  
  const ensureFinalTokenTracking = async (gameId: string) => {
    tokenTrackingAttemptsRef.current += 1;
    console.log(`[TOKEN TRACKING] Attempt #${tokenTrackingAttemptsRef.current} to ensure final token tracking`);
    
    if (tokenTrackingAttemptsRef.current > maxTokenTrackingAttempts && !forceTokenTrackingExecutedRef.current) {
      console.log(`[TOKEN TRACKING] Maximum tracking attempts (${maxTokenTrackingAttempts}) reached, forcing token tracking`);
      forceTokenTrackingExecutedRef.current = true;
      
      try {
        const estInputTokens = Math.max(1, Math.ceil(initialPrompt.length / 4));
        const estOutputTokens = Math.max(1, gameContentRef.current ? 
          Math.ceil(gameContentRef.current.length / 4) : 1000);
          
        const result = await forceTokenTracking(
          gameId,
          user?.id,
          initialPrompt,
          modelType,
          inputTokensRef.current > 0 ? inputTokensRef.current : estInputTokens,
          outputTokensRef.current > 0 ? outputTokensRef.current : estOutputTokens
        );
        
        if (result) {
          console.log("[TOKEN TRACKING] Forced token tracking succeeded");
          return;
        }
      } catch (error) {
        console.error("[TOKEN TRACKING] Error in forced token tracking:", error);
      }
    }
    
    if (tokenTrackingAttemptedRef.current) {
      console.log("[TOKEN TRACKING] Token tracking already attempted, checking if successful");
      
      try {
        const { data, error } = await supabase
          .from('token_usage')
          .select('id, input_tokens, output_tokens')
          .eq('game_id', gameId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (error) {
          console.error("[TOKEN TRACKING] Error checking token records:", error);
        } else if (data?.id) {
          console.log("[TOKEN TRACKING] Found existing token record:", data);
          
          if ((data.input_tokens < 10 || data.output_tokens < 10) && 
              (inputTokensRef.current > 10 || outputTokensRef.current > 10)) {
            console.log("[TOKEN TRACKING] Existing token counts look suspicious, updating");
            
            if (messageIdRef.current) {
              await updateTokenCounts(
                messageIdRef.current,
                inputTokensRef.current || Math.ceil(initialPrompt.length / 4),
                outputTokensRef.current || Math.ceil(gameContentRef.current.length / 4)
              );
            }
          } else {
            console.log("[TOKEN TRACKING] Existing token record looks valid, skipping update");
            return;
          }
        }
      } catch (checkError) {
        console.error("[TOKEN TRACKING] Error checking token records:", checkError);
      }
    }
    
    try {
      console.log("[TOKEN TRACKING] Starting token tracking process");
      
      if (messageIdRef.current && inputTokensRef.current > 0 && outputTokensRef.current > 0) {
        console.log(`[TOKEN TRACKING] Using captured values - Message ID: ${messageIdRef.current}`);
        console.log(`[TOKEN TRACKING] Input tokens: ${inputTokensRef.current}, Output tokens: ${outputTokensRef.current}`);
        
        const result = await updateTokenCounts(
          messageIdRef.current,
          inputTokensRef.current,
          outputTokensRef.current
        );
        
        if (result) {
          console.log("[TOKEN TRACKING] Token update succeeded with existing message ID and token counts");
          tokenTrackingAttemptedRef.current = true;
          return;
        } else {
          console.error("[TOKEN TRACKING] Token update failed with existing values");
        }
      } else {
        console.log("[TOKEN TRACKING] No previous token values found, using saveInitialGenerationTokens");
        
        const estInputTokens = Math.max(1, Math.ceil(initialPrompt.length / 4));
        const estOutputTokens = Math.max(1, gameContentRef.current ? 
          Math.ceil(gameContentRef.current.length / 4) : 1000);
          
        console.log(`[TOKEN TRACKING] Using estimated counts - Input: ${estInputTokens}, Output: ${estOutputTokens}`);
        
        const result = await saveInitialGenerationTokens(
          user?.id,
          gameId,
          initialPrompt,
          modelType,
          estInputTokens,
          estOutputTokens
        );
        
        if (result) {
          console.log("[TOKEN TRACKING] Initial token tracking created successfully");
          tokenTrackingAttemptedRef.current = true;
          return;
        } else {
          console.error("[TOKEN TRACKING] Failed to create initial token tracking record");
        }
      }
    } catch (error) {
      console.error("[TOKEN TRACKING] Error in final token tracking:", error);
    }
    
    if (tokenTrackingAttemptsRef.current < maxTokenTrackingAttempts) {
      console.log(`[TOKEN TRACKING] Scheduling retry attempt #${tokenTrackingAttemptsRef.current + 1} in 2 seconds`);
      
      setTimeout(() => {
        ensureFinalTokenTracking(gameId);
      }, 2000);
    }
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
    if (isTokenInfo(newOutput)) {
      console.log("Skipping token info from terminal:", newOutput);
      return;
    }
  
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
        terminalOutput: updatedOutput,
        showTerminal: true
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
      
      setState(prev => ({ ...prev, showTerminal: true }));
      
      updateTerminalOutputWrapper("> Connecting to AI service...", true);
      updateTerminalOutputWrapper(`> Using prompt: "${initialPrompt}"`, true);
      
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
          budget_tokens: 3500
        } : undefined
      };
      
      console.log("Calling generate-game function with payload:", {
        gameIdLength: gameId?.length,
        promptLength: initialPrompt.length,
        promptContent: initialPrompt.substring(0, 50) + "...",
        gameType,
        modelType,
        hasImage: !!imageUrl,
        hasUserId: !!user?.id
      });
      
      updateTerminalOutputWrapper("> Preparing to send request to AI service...", true);
      
      gameContentRef.current = '';
      
      const apiUrl = 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/process-game-update';
      
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          gameId,
          message: initialPrompt,
          gameType,
          modelType: modelType,
          imageUrl: imageUrl || undefined,
          stream: true,
          userId: user?.id,
          thinking: {
            type: "enabled",
            budget_tokens: 3500
          }
        }),
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
      
      if (modelType === "smart" && response.body) {
        const reader = response.body.getReader();
        updateTerminalOutputWrapper("> Stream connected, processing real-time content...", true);
        
        let processedContent = '';
        let tokenInfo = null;
        let currentThinking = '';
        
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const eventData = line.slice(5).trim();
                
                if (eventData === '[DONE]') {
                  console.log("[TOKEN TRACKING] Stream complete");
                  break;
                }
                
                const data = JSON.parse(eventData) as StreamEvent;
                
                if ((data.type === 'token_usage' && data.usage) || data.token_usage) {
                  const usageData = data.usage || data.token_usage;
                  console.log("[TOKEN TRACKING] Received token usage from stream:", usageData);
                  tokenInfo = usageData;
                  inputTokens = tokenInfo.inputTokens;
                  outputTokens = tokenInfo.outputTokens;
                  tokenInfoExtracted = true;
                  
                  inputTokensRef.current = inputTokens;
                  outputTokensRef.current = outputTokens;
                  
                  if (gameId && user?.id) {
                    console.log("[TOKEN TRACKING] Saving token usage data directly from stream");
                    try {
                      await saveInitialGenerationTokens(
                        user.id,
                        gameId,
                        initialPrompt,
                        modelType,
                        inputTokens,
                        outputTokens
                      );
                    } catch (tokenSaveError) {
                      console.error("[TOKEN TRACKING] Error saving token data from stream:", tokenSaveError);
                    }
                  }
                  
                  console.log(`[TOKEN TRACKING] Token usage: ${inputTokens} input, ${outputTokens} output tokens`);
                  
                  continue;
                }
                
                if (data.thinking && data.thinking !== currentThinking) {
                  currentThinking = data.thinking;
                  updateTerminalOutputWrapper(`> Thinking: ${data.thinking}`, true);
                  continue;
                }
                
                if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
                  const thinking = data.delta.thinking || '';
                  if (thinking && thinking !== currentThinking) {
                    currentThinking = thinking;
                    updateTerminalOutputWrapper(`> Thinking: ${thinking}`, true);
                  }
                  continue;
                }
                
                if (data.type === 'content_block_delta' && data.delta?.text) {
                  const contentDelta = data.delta.text;
                  if (!isTokenInfo(contentDelta)) {
                    const cleanContent = removeTokenInfo(contentDelta);
                    if (cleanContent.trim()) {
                      processedContent += cleanContent;
                      updateTerminalOutputWrapper(`> ${cleanContent}`);
                    }
                  }
                  continue;
                }
                
                if (data.type === 'content_block_start' && data.content_block?.text) {
                  const contentBlock = data.content_block.text;
                  if (!isTokenInfo(contentBlock)) {
                    const cleanContent = removeTokenInfo(contentBlock);
                    if (cleanContent.trim()) {
                      processedContent += cleanContent;
                      updateTerminalOutputWrapper(`> ${cleanContent}`);
                    }
                  }
                  continue;
                }
                
                if (data.type === 'error') {
                  const errorMessage = data.error?.message || 'Unknown stream error';
                  updateTerminalOutputWrapper(`> Error: ${errorMessage}`, true);
                  throw new Error(errorMessage);
                }
              } catch (parseError) {
                if (!line.includes('[DONE]')) {
                  console.error('Error parsing SSE event:', parseError, 'Line:', line);
                }
              }
            }
          }
        }
        
        content = processedContent;
        gameContentRef.current = content;
        
        if (!tokenInfoExtracted) {
          inputTokens = Math.ceil(initialPrompt.length / 4);
          outputTokens = Math.ceil(content.length / 4);
          
          inputTokensRef.current = inputTokens;
          outputTokensRef.current = outputTokens;
          
          console.log(`[TOKEN TRACKING] Estimated token usage: ${inputTokens} input, ${outputTokens} output tokens`);
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
        gameContentRef.current = content;
        
        if (data.usage) {
          inputTokens = data.usage.input_tokens || data.usage.inputTokens || Math.ceil(initialPrompt.length / 4);
          outputTokens = data.usage.output_tokens || data.usage.outputTokens || Math.ceil(content.length / 4);
          tokenInfoExtracted = true;
          
          inputTokensRef.current = inputTokens;
          outputTokensRef.current = outputTokens;
          
          if (gameId && user?.id) {
            console.log("[TOKEN TRACKING] Saving token usage data from non-streaming response");
            try {
              await saveInitialGenerationTokens(
                user.id,
                gameId,
                initialPrompt,
                modelType,
                inputTokens,
                outputTokens
              );
            } catch (tokenSaveError) {
              console.error("[TOKEN TRACKING] Error saving token data from non-streaming response:", tokenSaveError);
            }
          }
          
          console.log(`[TOKEN TRACKING] Token usage: ${inputTokens} input, ${outputTokens} output tokens`);
        } else {
          inputTokens = Math.ceil(initialPrompt.length / 4);
          outputTokens = Math.ceil(content.length / 4);
          
          inputTokensRef.current = inputTokens;
          outputTokensRef.current = outputTokens;
          
          console.log(`[TOKEN TRACKING] Estimated token usage: ${inputTokens} input, ${outputTokens} output tokens`);
        }
        
        updateTerminalOutputWrapper("> Content received successfully", true);
      }
      
      if (!content || content.length < 100) {
        throw new Error("Received empty or invalid content from generation");
      }
      
      initialGenerationCompleteRef.current = true;
      updateTerminalOutputWrapper("> Processing and saving generated content...", true);
      
      const modelTypeForSave = modelType === "smart" ? "smart" : "fast";
      
      let gameName = null;
      try {
        updateTerminalOutputWrapper("> Generating a name for your design...", true);
        console.log("[NAME_GEN] Starting name generation from usePlayTerminal for prompt:", initialPrompt.substring(0, 50) + "...");
        
        gameName = await generateGameName(initialPrompt);
        
        if (gameName && gameName.trim() !== '') {
          console.log("[NAME_GEN] Successfully generated name:", gameName);
          updateTerminalOutputWrapper(`> Generated name: "${gameName}"`, true);
        } else {
          console.log("[NAME_GEN] No name was returned or empty name");
          updateTerminalOutputWrapper("> Could not generate a name, using prompt as fallback", true);
          gameName = initialPrompt.split(' ').slice(0, 3).join(' ') + '...';
        }
      } catch (nameError) {
        console.error("[NAME_GEN] Error generating game name:", nameError);
        updateTerminalOutputWrapper("> Could not generate a name, using prompt as fallback", true);
        gameName = initialPrompt.split(' ').slice(0, 3).join(' ') + '...';
      }
      
      // Set the flag to prevent race conditions in version creation
      versionCreationInProgressRef.current = true;

      try {
        // First, check if there's any existing version higher than 1
        const { data: existingVersions, error: versionCheckError } = await supabase
          .from('game_versions')
          .select('version_number')
          .eq('game_id', gameId)
          .order('version_number', { ascending: false })
          .limit(1);

        if (versionCheckError) {
          console.error("Error checking existing versions:", versionCheckError);
          // Continue anyway, just log the error
        }

        const hasExistingVersions = existingVersions && existingVersions.length > 0 && existingVersions[0].version_number > 1;

        // If there are already versions beyond the initial one, don't create another one
        if (!hasExistingVersions) {
          console.log("Updating initial version with generated content");

          const { error: gameUpdateError } = await supabase
            .from('games')
            .update({
              code: content,
              instructions: "Initial content generated successfully",
              model_type: modelTypeForSave,
              prompt: initialPrompt,
              name: gameName || initialPrompt.substring(0, 50)
            })
            .eq('id', gameId);
            
          if (gameUpdateError) {
            console.error("Error updating game:", gameUpdateError);
            throw new Error(`Database error: ${gameUpdateError.message}`);
          }
          
          // Only update version 1, don't create a new one
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
        } else {
          console.log("Skipping version update as non-initial versions already exist");
        }
      } finally {
        // Reset the flag
        versionCreationInProgressRef.current = false;
      }
      
      try {
        const { data: initialMessageData, error: initialMessageError } = await supabase
          .from('game_messages')
          .select('id')
          .eq('game_id', gameId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
          
        if (initialMessageError) {
          console.error("Error finding initial game_message:", initialMessageError);
        } else if (initialMessageData?.id) {
          console.log("Found initial game_message to update:", initialMessageData.id);
          
          const { error: updateMessageError } = await supabase
            .from('game_messages')
            .update({ response: "Content generated" })
            .eq('id', initialMessageData.id);
            
          if (updateMessageError) {
            console.error("Error updating initial game_message response:", updateMessageError);
          } else {
            console.log("Updated initial game_message response to 'Content generated'");
          }
          
          if (inputTokensRef.current > 0 && outputTokensRef.current > 0) {
            console.log("Creating token_usage record for initial generation");
            
            const { error: tokenUsageError } = await supabase
              .from('token_usage')
              .insert({
                user_id: user?.id,
                game_id: gameId,
                message_id: initialMessageData.id,
                prompt: initialPrompt.substring(0, 5000),
                input_tokens: inputTokensRef.current,
                output_tokens: outputTokensRef.current,
                model_type: modelTypeForSave
              });
              
            if (tokenUsageError) {
              console.error("Error creating token_usage record:", tokenUsageError);
            } else {
              console.log("Successfully created token_usage record for initial generation");
            }
          }
        }
      } catch (messageUpdateError) {
        console.error("Error in game_message and token_usage update flow:", messageUpdateError);
      }
      
      updateTerminalOutputWrapper("> Content saved successfully", true);
      
      if (tokenTrackingAttemptsRef.current < maxTokenTrackingAttempts) {
        console.log(`[TOKEN TRACKING] Scheduling retry attempt #${tokenTrackingAttemptsRef.current + 1} in 2 seconds`);
        
        setTimeout(() => {
          ensureFinalTokenTracking(gameId);
        }, 2000);
      }
      
      updateTerminalOutputWrapper("> Generation complete! Updating display...", true);
      
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
        
        // Keep terminal visible a bit longer so users can see the completion
        setTimeout(() => {
          setState(prev => ({ ...prev, showTerminal: false }));
          
          // Only send this message if we're not already in the process of version creation
          if (!versionCreationInProgressRef.current) {
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
          }
        }, 3000);
        
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

function isTokenInfo(text: string): boolean {
  if (!text) return false;
  
  return (
    text.includes("Tokens used:") ||
    text.includes("Token usage:") ||
    text.includes("input tokens") ||
    text.includes("output tokens") ||
    /\d+\s*input\s*,\s*\d+\s*output/.test(text) ||
    /\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens/.test(text) ||
    /input:?\s*\d+\s*,?\s*output:?\s*\d+/.test(text) ||
    /\b(input|output)\b.*?\b\d+\b/.test(text)
  );
}

function removeTokenInfo(content: string): string {
  if (!content) return content;

  content = content.replace(/Tokens used:.*?(input|output).*?\n/g, '');
  content = content.replace(/Token usage:.*?(input|output).*?\n/g, '');
  content = content.replace(/.*?\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens.*?\n/g, '');
  content = content.replace(/.*?\d+\s*input\s*,\s*\d+\s*output.*?\n/g, '');
  content = content.replace(/.*?input:?\s*\d+\s*,?\s*output:?\s*\d+.*?\n/g, '');
  
  content = content.replace(/Tokens used:.*?(input|output).*?(?=\s)/g, '');
  content = content.replace(/Token usage:.*?(input|output).*?(?=\s)/g, '');
  content = content.replace(/\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens/g, '');
  content = content.replace(/\d+\s*input\s*,\s*\d+\s*output/g, '');
  content = content.replace(/input:?\s*\d+\s*,?\s*output:?\s*\d+/g, '');
  
  content = content.replace(/input tokens:.*?output tokens:.*?(?=\s)/g, '');
  content = content.replace(/input:.*?output:.*?(?=\s)/g, '');
  
  content = content.replace(/\b\d+ input\b/g, '');
  content = content.replace(/\b\d+ output\b/g, '');
  
  return content.trim();
}
