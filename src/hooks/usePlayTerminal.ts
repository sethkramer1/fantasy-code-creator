
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ModelType } from "@/types/generation";
import { supabase } from "@/integrations/supabase/client";
import { saveGeneratedGame } from "@/services/generation/gameStorageService";
import { useAuth } from "@/context/AuthContext";

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
  const { toast } = useToast();
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

  const updateTerminalOutput = (newOutput: string, isNewMessage = false) => {
    setState(prev => ({
      ...prev,
      terminalOutput: isNewMessage 
        ? [...prev.terminalOutput, newOutput] 
        : [...prev.terminalOutput.slice(0, -1), newOutput]
    }));
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

  const processAnthropicStream = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    let content = '';
    let buffer = '';
    let currentLineContent = '';
    
    try {
      updateTerminalOutput("> Stream connected, processing content...", true);
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          updateTerminalOutput("> Stream complete", true);
          break;
        }
        
        const text = new TextDecoder().decode(value);
        buffer += text;
        
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          if (!line) continue;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(5));
              
              switch (data.type) {
                case 'message_start':
                  updateTerminalOutput("> Generation started", true);
                  break;
                  
                case 'content_block_start':
                  if (data.content_block?.type === 'thinking') {
                    updateTerminalOutput("> Thinking phase started...", true);
                  }
                  break;
                  
                case 'content_block_delta':
                  if (data.delta?.type === 'thinking_delta') {
                    const thinking = data.delta.thinking || '';
                    if (thinking && thinking.trim()) {
                      updateTerminalOutput(`> Thinking: ${thinking}`, true);
                    }
                  } else if (data.delta?.type === 'text_delta') {
                    const contentChunk = data.delta.text || '';
                    if (contentChunk) {
                      content += contentChunk;
                      gameContentRef.current += contentChunk;
                      
                      if (contentChunk.includes('\n')) {
                        const lines = contentChunk.split('\n');
                        
                        if (lines[0]) {
                          currentLineContent += lines[0];
                          updateTerminalOutput(`> ${currentLineContent}`, false);
                        }
                        
                        for (let i = 1; i < lines.length - 1; i++) {
                          if (lines[i].trim()) {
                            currentLineContent = lines[i];
                            updateTerminalOutput(`> ${currentLineContent}`, true);
                          }
                        }
                        
                        if (lines.length > 1) {
                          currentLineContent = lines[lines.length - 1];
                          if (currentLineContent) {
                            updateTerminalOutput(`> ${currentLineContent}`, true);
                          } else {
                            currentLineContent = '';
                          }
                        }
                      } else {
                        currentLineContent += contentChunk;
                        updateTerminalOutput(`> ${currentLineContent}`, false);
                      }
                    }
                  }
                  break;
                  
                case 'content_block_stop':
                  if (data.content_block?.type === 'thinking') {
                    updateTerminalOutput("> Thinking phase completed", true);
                  }
                  break;
                  
                case 'message_delta':
                  if (data.delta?.stop_reason) {
                    updateTerminalOutput(`> Generation ${data.delta.stop_reason}`, true);
                  }
                  break;
                  
                case 'message_stop':
                  updateTerminalOutput("> Generation completed!", true);
                  break;
                  
                case 'error':
                  throw new Error(data.error?.message || 'Unknown error in stream');
              }
            } catch (e) {
              console.error('Error parsing SSE line:', e);
              console.log('Raw data that failed to parse:', line.slice(5));
              updateTerminalOutput(`> Warning: Error parsing stream data, continuing...`, true);
            }
          }
        }
      }
      
      return content;
    } catch (error) {
      console.error("Stream processing error:", error);
      updateTerminalOutput(`> Error: ${error.message}`, true);
      throw error;
    }
  };

  // Function to make API call with retry logic
  const makeApiCallWithRetry = async () => {
    try {
      updateTerminalOutput(`> Attempt ${retryCount.current + 1} to generate content...`, true);
      
      console.log("Starting generation process for gameId:", gameId);
      
      const payload = {
        gameId,
        prompt: initialPrompt,
        gameType,
        modelType: modelType as ModelType,
        imageUrl: imageUrl || undefined,
        stream: modelType === "smart",
        userId: user?.id
      };
      
      const apiUrl = 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game';
      
      console.log("Calling generate-game function with payload:", {
        gameIdLength: gameId?.length,
        promptLength: initialPrompt.length,
        gameType,
        modelType,
        hasImage: !!imageUrl,
        hasUserId: !!user?.id
      });
      
      updateTerminalOutput("> Connecting to AI service...", true);
      
      // Reset the game content reference
      gameContentRef.current = '';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`
        },
        body: JSON.stringify(payload),
        // Increase timeout for larger generations
        signal: AbortSignal.timeout(180000) // 3 minute timeout
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        throw new Error(`API error (${response.status}): ${errorText.substring(0, 200)}`);
      }
      
      updateTerminalOutput("> Connection established, receiving content...", true);
      
      let content = '';
      
      if (modelType === "smart" && response.body) {
        const reader = response.body.getReader();
        content = await processAnthropicStream(reader);
      } else {
        const data = await response.json();
        console.log("Non-streaming response received:", {
          hasContent: !!data.content,
          contentLength: data.content?.length || 0
        });
        
        if (!data.content || data.content.length < 100) {
          throw new Error("Received empty or invalid content from generation");
        }
        
        content = data.content;
        updateTerminalOutput("> Content received successfully", true);
      }
      
      // Use accumulated content from the stream reference if available
      if (gameContentRef.current && gameContentRef.current.length > 100) {
        content = gameContentRef.current;
      }
      
      if (!content || content.length < 100) {
        throw new Error("Received empty or invalid content from generation");
      }
      
      if (!content.includes("<html") && !content.includes("<!DOCTYPE") && !content.includes("<svg")) {
        updateTerminalOutput("> Warning: Generated content may not be valid HTML. Attempting to fix...", true);
        
        if (content.includes('<') && content.includes('>')) {
          content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
</head>
<body>
  ${content}
</body>
</html>`;
          updateTerminalOutput("> Content wrapped in HTML structure", true);
        } else {
          throw new Error("Generated content is not valid HTML and cannot be fixed");
        }
      }
      
      updateTerminalOutput("> Processing and saving generated content...", true);
      
      // Save the game to the database
      try {
        await saveGeneratedGame({
          gameContent: content,
          prompt: initialPrompt,
          gameType,
          modelType: modelType as ModelType,
          imageUrl: imageUrl || undefined,
          existingGameId: gameId,
          instructions: "Initial content generated successfully",
          userId: user?.id
        });
        
        updateTerminalOutput("> Content saved successfully", true);
        
        // Update message if needed
        await supabase
          .from('game_messages')
          .update({ response: "Initial content generated successfully" })
          .eq('game_id', gameId)
          .is('response', null);
          
        console.log("Generation completed successfully");
        
        // Reset retry counter on success
        retryCount.current = 0;
      } catch (saveError) {
        console.error("Error saving game:", saveError);
        updateTerminalOutput(`> Error saving game: ${saveError.message}`, true);
        throw saveError;
      }
      
      return true;
    } catch (error) {
      console.error(`Generation attempt ${retryCount.current + 1} failed:`, error);
      updateTerminalOutput(`> Error: ${error.message}`, true);
      
      // Check if we should retry
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        updateTerminalOutput(`> Retrying generation (attempt ${retryCount.current} of ${maxRetries})...`, true);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retrying
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
        
        updateTerminalOutput(`> Processing request: "${initialPrompt}"${imageUrl ? ' (with image)' : ''}`, true);
        updateTerminalOutput(`> Using ${modelType === "smart" ? "Anthropic (Smartest)" : "Groq (Fastest)"} model`, true);
        
        // Reset retry counter
        retryCount.current = 0;
        
        // Call API with retry logic
        await makeApiCallWithRetry();
        
        setState(prev => ({ 
          ...prev, 
          generationInProgress: false,
          generationComplete: true
        }));
        
        setTimeout(() => {
          setState(prev => ({ ...prev, showTerminal: false }));
          
          toast({
            title: "Generation Complete",
            description: "Content has been generated successfully.",
          });
        }, 1500);
        
      } catch (error) {
        console.error("Error in generateInitialContent:", error);
        
        updateTerminalOutput(`> Fatal Error: ${error.message}`, true);
        updateTerminalOutput(`> Generation failed after ${retryCount.current} retries`, true);
        
        setState(prev => ({ 
          ...prev, 
          generationInProgress: false,
          generationError: error.message
        }));
        
        toast({
          title: "Generation Error",
          description: error.message || "Failed to generate content",
          variant: "destructive",
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
  }, [gameId, generating, initialPrompt, gameType, modelType, imageUrl, toast, user]);

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
