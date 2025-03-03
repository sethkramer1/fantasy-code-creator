
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
        if (modelType === "smart" && response.body) {
          // Handle streaming response
          const reader = response.body.getReader();
          let content = '';
          let lastMessageTime = Date.now();
          const IDLE_TIMEOUT = 30000; // 30 seconds timeout
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                updateTerminalOutput("> Stream complete", true);
                break;
              }
              
              // Reset timeout on new data
              lastMessageTime = Date.now();
              
              // Decode and process the data
              const text = new TextDecoder().decode(value);
              content += text;
              
              // Check for thinking message
              if (text.includes("thinking: ")) {
                const thinkingMatch = text.match(/thinking: (.*?)(?=\n|$)/);
                if (thinkingMatch && thinkingMatch[1]) {
                  updateTerminalOutput(`> [Thinking] ${thinkingMatch[1]}`, true);
                }
              }
              
              // Check timeout during streaming
              const checkTimeout = () => {
                if (Date.now() - lastMessageTime > IDLE_TIMEOUT) {
                  console.warn("Stream timeout detected");
                  reader.cancel("Stream timeout");
                  throw new Error("Generation timed out. The service took too long to respond.");
                }
              };
              
              // Schedule timeout check
              setTimeout(checkTimeout, IDLE_TIMEOUT);
            }
            
            // Validate the content
            if (!content || content.length < 100) {
              throw new Error("Received empty or invalid content from generation");
            }
            
            // Check if content is valid HTML/SVG
            if (!content.includes("<html") && !content.includes("<!DOCTYPE") && !content.includes("<svg")) {
              throw new Error("Generated content is not valid HTML or SVG");
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
            
          } catch (streamError) {
            console.error("Stream processing error:", streamError);
            updateTerminalOutput(`> Error: ${streamError.message}`, true);
            
            setState(prev => ({ 
              ...prev, 
              generationInProgress: false,
              generationError: streamError.message
            }));
            
            throw streamError;
          }
        } else {
          // Handle non-streaming response
          const data = await response.json();
          console.log("Non-streaming response received:", data);
          
          if (!data.content || data.content.length < 100) {
            throw new Error("Received empty or invalid content from generation");
          }
          
          updateTerminalOutput("> Content received, saving to database...", true);
          
          // Save the generated content
          await saveGeneratedGame({
            gameContent: data.content,
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
        }
        
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
