
import { useState, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { contentTypes } from "@/types/game";
import { GenerationOptions, GenerationResult, ModelType } from "@/types/generation";
import { callAnthropicApi } from "@/services/generation/anthropicService";
import { callGroqApi } from "@/services/generation/groqService";
import { saveGeneratedGame } from "@/services/generation/gameStorageService";
import { trackTokenUsage } from "@/components/game-chat/api-service";
import { useAuth } from "@/context/AuthContext";

export const useGameGeneration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [modelType, setModelType] = useState<ModelType>("smart");
  const timerRef = useRef<NodeJS.Timeout>();
  const maxRetries = 2;
  const currentThinkingRef = useRef<string>('');

  const generateGame = async ({
    prompt,
    gameType,
    imageUrl,
    existingGameId,
    modelType: requestModelType,
    visibility = "public"
  }: GenerationOptions): Promise<GenerationResult | null> => {
    if (!prompt.trim()) {
      toast({
        title: "Please enter a description",
        variant: "destructive",
      });
      return null;
    }

    if (!gameType) {
      toast({
        title: "Please select a content type",
        description: "Choose what you want to create before proceeding",
        variant: "destructive",
      });
      return null;
    }

    const activeModelType: ModelType = requestModelType || modelType;

    setLoading(true);
    setShowTerminal(true);
    setTerminalOutput([`> Starting generation with prompt: "${prompt}"${imageUrl ? ' (with image)' : ''}`]);
    currentThinkingRef.current = '';
    
    let gameContent = '';
    let combinedResponse = '';
    let retryCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const selectedType = contentTypes.find(type => type.id === gameType);
      if (!selectedType) throw new Error("Invalid content type selected");

      setTerminalOutput(prev => [...prev, `> Using ${activeModelType === "smart" ? "Anthropic (Smartest)" : "Groq (Fastest)"} model`]);

      setTerminalOutput(prev => [...prev, `> Establishing connection to AI service...`]);

      if (existingGameId) {
        setGameId(existingGameId);
      }

      const makeApiCallWithRetry = async (): Promise<string> => {
        try {
          if (activeModelType === "fast") {
            setTerminalOutput(prev => [...prev, `> Using non-streaming mode for Groq API${retryCount > 0 ? ` (retry attempt ${retryCount})` : ''}...`]);
            
            const { gameContent: groqContent, tokenInfo } = await callGroqApi(
              prompt,
              gameType,
              imageUrl,
              {
                onStreamStart: () => {
                  setTerminalOutput(prev => [...prev, `> Connected to Groq API, waiting for complete response...`]);
                },
                onContent: (content) => {
                  setTerminalOutput(prev => [...prev, `> ${content}`]);
                },
                onError: (error) => {
                  setTerminalOutput(prev => [...prev, `> Groq API error: ${error.message}`]);
                },
                onComplete: () => {
                  setTerminalOutput(prev => [...prev, `> Generation completed successfully`]);
                }
              }
            );
            
            if (tokenInfo) {
              inputTokens = tokenInfo.inputTokens || Math.ceil(prompt.length / 4);
              outputTokens = tokenInfo.outputTokens || Math.ceil(groqContent.length / 4);
            } else {
              inputTokens = Math.ceil(prompt.length / 4);
              outputTokens = Math.ceil(groqContent.length / 4);
            }
            
            return groqContent;
          } else {
            setTerminalOutput(prev => [...prev, `> Connecting to Anthropic API${retryCount > 0 ? ` (retry attempt ${retryCount})` : ''}...`]);
            
            console.log("Sending prompt to Anthropic:", prompt);
            
            const { gameContent: anthropicContent, tokenInfo } = await callAnthropicApi(
              prompt,
              gameType,
              imageUrl,
              retryCount > 0 ? combinedResponse : undefined,
              {
                onStreamStart: () => {
                  setTerminalOutput(prev => [...prev, `> Connected to generation service, receiving stream...`]);
                },
                onThinking: (thinking) => {
                  if (thinking !== currentThinkingRef.current) {
                    // Only update if thinking content has changed
                    currentThinkingRef.current = thinking;
                    setTerminalOutput(prev => [...prev, `> Thinking: ${thinking}`]);
                  }
                },
                onContent: (content) => {
                  combinedResponse += content;
                  
                  if (content.includes('\n')) {
                    const contentLines = content.split('\n');
                    for (const contentLine of contentLines) {
                      if (contentLine.trim()) {
                        setTerminalOutput(prev => [...prev, `> ${contentLine}`]);
                      }
                    }
                  } else {
                    setTerminalOutput(prev => [...prev, `> ${content}`]);
                  }
                },
                onError: (error) => {
                  setTerminalOutput(prev => [...prev, `> Stream error: ${error.message}`]);
                },
                onComplete: () => {
                  setTerminalOutput(prev => [...prev, `> Generation completed successfully`]);
                }
              }
            );
            
            if (tokenInfo) {
              inputTokens = tokenInfo.inputTokens || Math.ceil(prompt.length / 4);
              outputTokens = tokenInfo.outputTokens || Math.ceil(anthropicContent.length / 4);
            } else {
              inputTokens = Math.ceil(prompt.length / 4);
              outputTokens = Math.ceil((anthropicContent || combinedResponse).length / 4);
            }
            
            return anthropicContent || combinedResponse;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if ((errorMessage.includes('network') || 
               errorMessage.includes('Network') || 
               errorMessage.includes('timeout') || 
               errorMessage.includes('interrupted') ||
               errorMessage.includes('abort') || 
               errorMessage.includes('connection')) && 
              retryCount < maxRetries) {
            
            retryCount++;
            setTerminalOutput(prev => [...prev, `> Network error: ${errorMessage}. Retrying (attempt ${retryCount} of ${maxRetries})...`]);
            console.error(`Network error occurred, retrying (${retryCount}/${maxRetries}):`, error);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return makeApiCallWithRetry();
          }
          
          if (gameContent.length > 500) {
            setTerminalOutput(prev => [...prev, `> Error: ${errorMessage}, but using partial content collected so far.`]);
            console.warn("Using partial content despite error:", error);
            return combinedResponse;
          }
          
          throw error;
        }
      };
      
      gameContent = await makeApiCallWithRetry();
      
      setTerminalOutput(prev => [...prev, "> Saving to database..."]);

      const gameData = await saveGeneratedGame({
        gameContent,
        prompt,
        gameType,
        modelType: activeModelType,
        imageUrl,
        existingGameId,
        visibility
      });
      
      if (gameData && gameData.id) {
        setGameId(gameData.id);
        
        try {
          await trackTokenUsage(
            user?.id,
            gameData.id,
            `generation-${gameData.id}`,
            prompt,
            inputTokens,
            outputTokens,
            activeModelType
          );
        } catch (tokenError) {
          console.error("Error tracking token usage:", tokenError);
        }
      }
      
      setTerminalOutput(prev => [...prev, "> Saved successfully!"]);
      
      return gameData;

    } catch (error) {
      console.error('Generation error:', error);
      
      if (gameContent.length > 500 && existingGameId) {
        setTerminalOutput(prev => [...prev, `> Error occurred, but trying to save partial content: ${error instanceof Error ? error.message : String(error)}`]);
        try {
          const partialGameData = await saveGeneratedGame({
            gameContent,
            prompt,
            gameType,
            modelType: activeModelType,
            imageUrl,
            existingGameId,
            instructions: `Partial content (network error: ${error instanceof Error ? error.message : String(error)})`,
            visibility
          });
          
          setTerminalOutput(prev => [...prev, "> Saved partial content to database"]);
          
          return partialGameData;
        } catch (saveError) {
          console.error("Failed to save partial content:", saveError);
        }
      }
      
      toast({
        title: "Error generating content",
        description: `${error instanceof Error ? error.message : "Please try again"}${gameContent.length > 500 ? " (partial content may be available)" : ""}`,
        variant: "destructive",
      });
      setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : "Generation failed"}`]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    showTerminal,
    setShowTerminal,
    terminalOutput,
    thinkingTime,
    setThinkingTime,
    generateGame,
    timerRef,
    gameId,
    setGameId,
    modelType,
    setModelType
  };
};
