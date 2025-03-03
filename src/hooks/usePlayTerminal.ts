
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ModelType } from "@/types/generation";

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
            type: initialType,
            modelType: initialModelType,
            imageUrl: initialImageUrl
          });

          setTerminalOutput(prev => [...prev, `> Using ${initialModelType === "smart" ? "Claude (Smartest)" : "Groq (Fastest)"} model`]);
          
          // Always use the generate-game function for initial generation
          const apiUrl = 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game';
          
          setTerminalOutput(prev => [...prev, `> Connecting to generation service...`]);
          
          const payload = {
            prompt: initialPrompt,
            gameType: initialType,
            modelType: initialModelType as ModelType,
            gameId: gameId,
            stream: true // Always stream for better UX
          };
          
          if (initialImageUrl) {
            payload['imageUrl'] = initialImageUrl;
          }
          
          console.log("Sending payload to generate-game:", payload);
          
          const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`
            },
            body: JSON.stringify(payload)
          });

          if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`API error (${apiResponse.status}): ${errorText}`);
          }

          // Always handle streaming 
          if (apiResponse && apiResponse.body) {
            const reader = apiResponse.body.getReader();
            
            let partialResponse = "";
            let decoder = new TextDecoder();

            const processStream = async () => {
              try {
                let result;
                let processingComplete = false;
                
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
                          
                          if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
                            const thinking = data.delta.thinking || '';
                            if (thinking && thinking.trim()) {
                              setTerminalOutput(prev => [...prev, `> Thinking: ${thinking}`]);
                              console.log("Thinking update:", thinking);
                            }
                          } else if (data.delta?.text) {
                            setTerminalOutput(prev => [...prev, `> ${data.delta.text}`]);
                          }
                          
                          // Check if we're done
                          if (data.type === 'message_stop' || 
                             (data.delta && data.delta.stop_reason)) {
                            processingComplete = true;
                          }
                        } catch (e) {
                          console.error("Error parsing data:", e, "Line:", line);
                        }
                      }
                    }
                    
                    // Keep the last line which might be incomplete
                    partialResponse = lines[lines.length - 1];
                  }
                } while (!result.done && !processingComplete);

                setTerminalOutput(prev => [...prev, "> Generation completed successfully!"]);
                console.log("Stream processing completed");
                
                // Explicitly fetch the game version to ensure we have the latest data
                await fetchGameVersion(gameId);
                
                // Set a slight delay to ensure everything is complete before showing iframe
                setTimeout(() => {
                  setGenerationInProgress(false);
                }, 1000);
              } catch (e) {
                console.error("Streaming error:", e);
                setTerminalOutput(prev => [...prev, `> Error: ${e.message}`]);
                setGenerationInProgress(false);
              } finally {
                reader.releaseLock();
              }
            };

            processStream();
          } else {
            // Non-streaming fallback
            setTerminalOutput(prev => [...prev, "> Received complete response"]);
            
            // Explicitly fetch the game version to ensure we have the latest data
            await fetchGameVersion(gameId);
            
            // Set a slight delay to ensure everything is complete before showing iframe
            setTimeout(() => {
              setGenerationInProgress(false);
            }, 1000);
          }
        } catch (error) {
          console.error("Error during initial content fetch:", error);
          setTerminalOutput(prev => [...prev, `> Error: ${error.message}`]);
          setGenerationInProgress(false);
        }
      }
    };

    // Helper function to fetch the latest game version
    const fetchGameVersion = async (gameId: string) => {
      try {
        setTerminalOutput(prev => [...prev, "> Fetching the latest game version..."]);
        const { data, error } = await supabase
          .from('game_versions')
          .select('*')
          .eq('game_id', gameId)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();
          
        if (error) {
          console.error("Error fetching game version:", error);
          setTerminalOutput(prev => [...prev, `> Error fetching game version: ${error.message}`]);
          return;
        }
        
        if (data) {
          setTerminalOutput(prev => [...prev, `> Successfully fetched game version ${data.version_number}`]);
          console.log("Fetched game version:", data);
        } else {
          setTerminalOutput(prev => [...prev, `> No game version found`]);
        }
      } catch (error) {
        console.error("Error in fetchGameVersion:", error);
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
