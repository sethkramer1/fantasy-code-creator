import { useState, useEffect, useRef } from "react";
import { processGameUpdate } from "@/components/game-chat/api-service";

export function usePlayTerminal(gameId: string | undefined, generating: boolean, initialPrompt: string, initialType: string, initialModelType: string, initialImageUrl: string) {
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [thinkingTime, setThinkingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (generating && gameId) {
      console.log("Starting generation process for game:", gameId);
      setGenerationInProgress(true);
      setShowTerminal(true); // Automatically show terminal when generating
      setTerminalOutput([`> Starting generation for: "${initialPrompt}"`]);
    }
  }, [generating, gameId, initialPrompt]);

  useEffect(() => {
    if (generationInProgress && gameId) {
      // Start the timer when generation starts
      setThinkingTime(0);
      timerRef.current = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      // Clear the timer when generation is complete or stopped
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [generationInProgress, gameId]);

  useEffect(() => {
    const fetchInitialContent = async () => {
      if (gameId && generating) {
        try {
          console.log("Fetching initial content with:", {
            prompt: initialPrompt,
            modelType: initialModelType,
            imageUrl: initialImageUrl
          });

          setTerminalOutput(prev => [...prev, `> Using ${initialModelType === "smart" ? "Claude (Smartest)" : "Groq (Fastest)"} model`]);
          
          const { apiResponse, modelType } = await processGameUpdate(
            gameId,
            initialPrompt,
            initialModelType,
            initialImageUrl,
            (text, isNewMessage) => {
              setTerminalOutput(prev => {
                const newOutput = isNewMessage ? [...prev, text] : [...prev.slice(0, -1), text];
                return newOutput;
              });
            }
          );

          if (apiResponse && modelType === "smart") {
            const reader = apiResponse.body?.getReader();
            if (!reader) {
              throw new Error("ReadableStream not supported in this browser.");
            }

            let partialResponse = "";
            let decoder = new TextDecoder();

            const processStream = async () => {
              try {
                let result;
                do {
                  result = await reader.read();
                  if (result.value) {
                    const chunk = decoder.decode(result.value);
                    console.log("Received chunk:", chunk.substring(0, 100) + "...");
                    
                    partialResponse += chunk;
                    
                    // Split by lines to process each event
                    const lines = partialResponse.split("\n");
                    
                    // Process complete lines
                    for (let i = 0; i < lines.length - 1; i++) {
                      const line = lines[i].trim();
                      if (line.startsWith('data: ')) {
                        try {
                          const data = JSON.parse(line.substring(6));
                          
                          if (data.thinking) {
                            setTerminalOutput(prev => [...prev, `> Thinking: ${data.thinking}`]);
                          } else if (data.delta?.text) {
                            setTerminalOutput(prev => [...prev, `> ${data.delta.text}`]);
                          }
                        } catch (e) {
                          console.error("Error parsing data:", e, "Line:", line);
                        }
                      }
                    }
                    
                    // Keep the last line which might be incomplete
                    partialResponse = lines[lines.length - 1];
                  }
                } while (!result.done);

                setTerminalOutput(prev => [...prev, "> Generation completed successfully!"]);
                console.log("Stream processing completed");
              } catch (e) {
                console.error("Streaming error:", e);
                setTerminalOutput(prev => [...prev, `> Error: ${e.message}`]);
              } finally {
                setGenerationInProgress(false);
                reader.releaseLock();
              }
            };

            processStream();
          } else {
            // Non-streaming case (Groq/fast model)
            const responseData = await apiResponse.json();
            setTerminalOutput(prev => [...prev, "> Received complete response from fast model"]);
            setGenerationInProgress(false);
          }
        } catch (error) {
          console.error("Error during initial content fetch:", error);
          setTerminalOutput(prev => [...prev, `> Error: ${error.message}`]);
          setGenerationInProgress(false);
        }
      }
    };

    fetchInitialContent();
  }, [gameId, generating, initialPrompt, initialType, initialModelType, initialImageUrl]);

  const handleTerminalStatusChange = (showing: boolean, output: string[], thinking: number, isLoading: boolean) => {
    setShowTerminal(showing);
    setTerminalOutput(output);
    setThinkingTime(thinking);
    setGenerationInProgress(isLoading);
  };

  return {
    generationInProgress,
    terminalOutput,
    showTerminal,
    thinkingTime,
    handleTerminalStatusChange,
    setShowTerminal
  };
}
