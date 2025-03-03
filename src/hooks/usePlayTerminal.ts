
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ModelType } from "@/types/generation";
import { supabase } from "@/integrations/supabase/client";
import { saveGeneratedGame } from "@/services/generation/gameStorageService";
import { useAuth } from "@/context/AuthContext";
import { updateTerminalOutput, processAnthropicStream } from "@/components/game-chat/terminal-utils";

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

  const updateTerminalOutputWrapper = (newOutput: string, isNewMessage = false) => {
    updateTerminalOutput(
      (output) => setState(prev => ({ ...prev, terminalOutput: output })),
      newOutput,
      isNewMessage
    );
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

  // Function to make API call with retry logic
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
        userId: user?.id
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
      
      updateTerminalOutputWrapper("> Connection established, receiving content...", true);
      
      let content = '';
      
      if (modelType === "smart" && response.body) {
        const reader = response.body.getReader();
        updateTerminalOutputWrapper("> Stream connected, processing real-time content...", true);
        content = await processAnthropicStream(reader, updateTerminalOutputWrapper);
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
        updateTerminalOutputWrapper("> Content received successfully", true);
      }
      
      // Use accumulated content from the stream reference if available
      if (gameContentRef.current && gameContentRef.current.length > 100) {
        content = gameContentRef.current;
      }
      
      if (!content || content.length < 100) {
        throw new Error("Received empty or invalid content from generation");
      }
      
      if (!content.includes("<html") && !content.includes("<!DOCTYPE") && !content.includes("<svg")) {
        updateTerminalOutputWrapper("> Warning: Generated content may not be valid HTML. Attempting to fix...", true);
        
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
          updateTerminalOutputWrapper("> Content wrapped in HTML structure", true);
        } else {
          throw new Error("Generated content is not valid HTML and cannot be fixed");
        }
      }
      
      updateTerminalOutputWrapper("> Processing and saving generated content...", true);
      
      // Save the game to the database
      try {
        const modelTypeForSave = modelType === "smart" ? "smart" : "fast";
        
        // Save the game directly using supabase client to avoid type errors
        // First update the game
        const { error: gameUpdateError } = await supabase
          .from('games')
          .update({
            code: content,
            instructions: "Initial content generated successfully",
            model_type: modelTypeForSave,
            prompt: initialPrompt // Make sure we save the actual prompt
          })
          .eq('id', gameId);
          
        if (gameUpdateError) {
          console.error("Error updating game:", gameUpdateError);
          throw new Error(`Database error: ${gameUpdateError.message}`);
        }
          
        // Then update the game version
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
        updateTerminalOutputWrapper(`> Error saving game: ${saveError.message}`, true);
        throw saveError;
      }
      
      return true;
    } catch (error) {
      console.error(`Generation attempt ${retryCount.current + 1} failed:`, error);
      updateTerminalOutputWrapper(`> Error: ${error.message}`, true);
      
      // Check if we should retry
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        updateTerminalOutputWrapper(`> Retrying generation (attempt ${retryCount.current} of ${maxRetries})...`, true);
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
        
        updateTerminalOutputWrapper(`> Processing request: "${initialPrompt}"${imageUrl ? ' (with image)' : ''}`, true);
        updateTerminalOutputWrapper(`> Using ${modelType === "smart" ? "Anthropic (Smartest)" : "Groq (Fastest)"} model`, true);
        
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
        
        updateTerminalOutputWrapper(`> Fatal Error: ${error.message}`, true);
        updateTerminalOutputWrapper(`> Generation failed after ${retryCount.current} retries`, true);
        
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
