
import { useState, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { contentTypes } from "@/types/game";
import { GenerationOptions, GenerationResult, ModelType } from "@/types/generation";
import { callAnthropicApi } from "@/services/generation/anthropicService";
import { callGroqApi } from "@/services/generation/groqService";
import { saveGeneratedGame } from "@/services/generation/gameStorageService";

export const useGameGeneration = () => {
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [modelType, setModelType] = useState<ModelType>("smart"); // Changed from string to ModelType
  const timerRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const maxRetries = 2; // Maximum number of retry attempts for network errors

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

    // Use the passed model type or fall back to the state value
    const activeModelType: ModelType = requestModelType || modelType;

    setLoading(true);
    setShowTerminal(true);
    setTerminalOutput([`> Starting generation with prompt: "${prompt}"${imageUrl ? ' (with image)' : ''}`]);
    
    let gameContent = '';
    let combinedResponse = '';
    let retryCount = 0;

    try {
      const selectedType = contentTypes.find(type => type.id === gameType);
      if (!selectedType) throw new Error("Invalid content type selected");

      // Log which model is being used
      setTerminalOutput(prev => [...prev, `> Using ${activeModelType === "smart" ? "Anthropic (Smartest)" : "Groq (Fastest)"} model`]);

      // Show connecting message immediately for better UX
      setTerminalOutput(prev => [...prev, `> Establishing connection to AI service...`]);

      // Function to handle API calls with retries
      const makeApiCallWithRetry = async (): Promise<string> => {
        try {
          if (activeModelType === "fast") {
            // Use Groq API
            setTerminalOutput(prev => [...prev, `> Using non-streaming mode for Groq API${retryCount > 0 ? ` (retry attempt ${retryCount})` : ''}...`]);
            
            const { gameContent: groqContent } = await callGroqApi(
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
            
            return groqContent;
          } else {
            // Use Anthropic API
            setTerminalOutput(prev => [...prev, `> Connecting to Anthropic API${retryCount > 0 ? ` (retry attempt ${retryCount})` : ''}...`]);
            
            const { gameContent: anthropicContent } = await callAnthropicApi(
              prompt,
              gameType,
              imageUrl,
              retryCount > 0 ? combinedResponse : undefined,
              {
                onStreamStart: () => {
                  setTerminalOutput(prev => [...prev, `> Connected to generation service, receiving stream...`]);
                },
                onThinking: (thinking) => {
                  setTerminalOutput(prev => [...prev, `> ${thinking}`]);
                },
                onContent: (content) => {
                  combinedResponse += content;
                  
                  // Display the content in smaller chunks for better visibility
                  if (content.includes('\n')) {
                    // If it contains newlines, split it and display each line
                    const contentLines = content.split('\n');
                    for (const contentLine of contentLines) {
                      if (contentLine.trim()) {
                        setTerminalOutput(prev => [...prev, `> ${contentLine}`]);
                      }
                    }
                  } else {
                    // Otherwise display the chunk directly
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
            
            return anthropicContent || combinedResponse;
          }
        } catch (error) {
          // Handle retryable errors
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
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try again
            return makeApiCallWithRetry();
          }
          
          // If we've collected some content, try to use that even if we hit an error
          if (combinedResponse.length > 500) {
            setTerminalOutput(prev => [...prev, `> Error: ${errorMessage}, but using partial content collected so far.`]);
            console.warn("Using partial content despite error:", error);
            return combinedResponse;
          }
          
          // Otherwise, propagate the error
          throw error;
        }
      };
      
      // Make API call with retries
      gameContent = await makeApiCallWithRetry();
      
      setTerminalOutput(prev => [...prev, "> Saving to database..."]);

      // Save the generated game
      const gameData = await saveGeneratedGame({
        gameContent,
        prompt,
        gameType,
        modelType: activeModelType,
        imageUrl,
        existingGameId,
        visibility
      });
      
      setTerminalOutput(prev => [...prev, "> Saved successfully!"]);
      
      return gameData;

    } catch (error) {
      console.error('Generation error:', error);
      
      // If we have some usable content even after error, try to save it
      if (gameContent.length > 500 && existingGameId) {
        setTerminalOutput(prev => [...prev, `> Error occurred, but trying to save partial content: ${error instanceof Error ? error.message : String(error)}`]);
        try {
          // Attempt to save the partial game content with error indication
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
          
          // Return the existing game ID to avoid losing progress
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
