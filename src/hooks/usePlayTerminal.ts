
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
      setGenerationInProgress(true);
      // Start with a placeholder message
      setTerminalOutput([`> Generating initial content...`]);
    }
  }, [generating, gameId]);

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
  }, [generationInProgress]);

  useEffect(() => {
    const fetchInitialContent = async () => {
      if (gameId && generating) {
        try {
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
                    partialResponse += decoder.decode(result.value);
                    // Split by double newline to delineate messages
                    const messages = partialResponse.split("\n\n");
                    // Update terminal output with each message
                    messages.forEach((message, index) => {
                      if (message) {
                        setTerminalOutput(prev => {
                          const newOutput = [...prev.slice(0, -1), message];
                          return newOutput;
                        });
                      }
                    });
                    partialResponse = messages[messages.length - 1] || "";
                  }
                } while (!result.done);

                // Handle the last part of the response
                if (partialResponse) {
                  setTerminalOutput(prev => [...prev, partialResponse]);
                }
              } catch (e) {
                console.error("Streaming error:", e);
              } finally {
                setGenerationInProgress(false);
                reader.releaseLock();
              }
            };

            processStream();
          } else {
            setGenerationInProgress(false);
          }
        } catch (error) {
          console.error("Error during initial content fetch:", error);
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
