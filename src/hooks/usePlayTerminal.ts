
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ModelType } from "@/types/generation";
import { supabase } from "@/integrations/supabase/client";
import { saveGeneratedGame } from "@/services/generation/gameStorageService";

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

  // Function to update terminal output
  const updateTerminalOutput = (newOutput: string, isNewMessage = false) => {
    setState(prev => ({
      ...prev,
      terminalOutput: isNewMessage 
        ? [...prev.terminalOutput, newOutput] 
        : [...prev.terminalOutput.slice(0, -1), newOutput]
    }));
  };

  // Start the thinking timer when generation begins
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

  // Function to process streaming data from Anthropic API
  const processAnthropicStream = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    let content = '';
    let buffer = '';
    let currentLineContent = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          updateTerminalOutput("> Stream complete", true);
          break;
        }
        
        // Decode the chunk and add it to our buffer
        const text = new TextDecoder().decode(value);
        buffer += text;
        
        // Process complete lines from the buffer
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          // Skip empty lines
          if (!line) continue;
          
          // Handle Anthropic streaming format
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
                      
                      // Handle multiline content chunks
                      if (contentChunk.includes('\n')) {
                        const lines = contentChunk.split('\n');
                        
                        // Add first line to current line
                        if (lines[0]) {
                          currentLineContent += lines[0];
                          updateTerminalOutput(`> ${currentLineContent}`, false);
                        }
                        
                        // Add middle lines as separate entries
                        for (let i = 1; i < lines.length - 1; i++) {
                          if (lines[i].trim()) {
                            currentLineContent = lines[i];
                            updateTerminalOutput(`> ${currentLineContent}`, true);
                          }
                        }
                        
                        // Start a new current line with the last part
                        if (lines.length > 1) {
                          currentLineContent = lines[lines.length - 1];
                          if (currentLineContent) {
                            updateTerminalOutput(`> ${currentLineContent}`, true);
                          } else {
                            currentLineContent = '';
                          }
                        }
                      } else {
                        // Add to current line for single-line chunks
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

  // Handle initial generation
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
        updateTerminalOutput("> Sending request to generate-game function...", true);
        
        console.log("Starting generation process for gameId:", gameId);
        
        // Prepare the payload
        const payload = {
          gameId,
          prompt: initialPrompt,
          gameType,
          modelType: modelType as ModelType,
          imageUrl: imageUrl || undefined,
          stream: modelType === "smart" // Stream only for Anthropic (smart)
        };
        
        // Call the appropriate API endpoint
        const apiUrl = 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game';
        
        console.log("Calling generate-game function with payload:", payload);
        updateTerminalOutput("> Connecting to AI service...", true);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error:", response.status, errorText);
          throw new Error(`API error (${response.status}): ${errorText.substring(0, 200)}`);
        }
        
        updateTerminalOutput("> Connection established, receiving content...", true);
        
        // Process the streaming or non-streaming response
        let content = '';
        
        if (modelType === "smart" && response.body) {
          // Handle streaming response
          const reader = response.body.getReader();
          content = await processAnthropicStream(reader);
        } else {
          // Handle non-streaming response
          const data = await response.json();
          console.log("Non-streaming response received:", data);
          
          if (!data.content || data.content.length < 100) {
            throw new Error("Received empty or invalid content from generation");
          }
          
          content = data.content;
          updateTerminalOutput("> Content received successfully", true);
        }
        
        // Validate the content
        if (!content || content.length < 100) {
          throw new Error("Received empty or invalid content from generation");
        }
        
        // Check if content is valid HTML/SVG
        if (!content.includes("<html") && !content.includes("<!DOCTYPE") && !content.includes("<svg")) {
          updateTerminalOutput("> Warning: Generated content may not be valid HTML. Attempting to fix...", true);
          
          // Try to wrap the content in HTML if it's not already
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
          } else {
            throw new Error("Generated content is not valid HTML and cannot be fixed");
          }
        }
        
        updateTerminalOutput("> Processing and saving generated content...", true);
        
        // Save the generated content
        await saveGeneratedGame({
          gameContent: content,
          prompt: initialPrompt,
          gameType,
          modelType: modelType as ModelType,
          imageUrl: imageUrl || undefined,
          existingGameId: gameId,
          instructions: "Initial content generated successfully"
        });
        
        updateTerminalOutput("> Content saved successfully", true);
        
        // Update game messages with success response
        await supabase
          .from('game_messages')
          .update({ response: "Initial content generated successfully" })
          .eq('game_id', gameId)
          .is('response', null);
          
        console.log("Generation completed successfully");
        
        setState(prev => ({ 
          ...prev, 
          generationInProgress: false,
          generationComplete: true
        }));
        
        // Final message
        updateTerminalOutput("> Generation completed, switching to content view...", true);
        
        setTimeout(() => {
          setState(prev => ({ ...prev, showTerminal: false }));
          
          toast({
            title: "Generation Complete",
            description: "Content has been generated successfully.",
          });
        }, 1500);
        
      } catch (error) {
        console.error("Error in generateInitialContent:", error);
        
        updateTerminalOutput(`> Error: ${error.message}`, true);
        
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
  }, [gameId, generating, initialPrompt, gameType, modelType, imageUrl, toast]);

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
