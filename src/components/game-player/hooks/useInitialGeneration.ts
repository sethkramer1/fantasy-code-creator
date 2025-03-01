
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useInitialGeneration() {
  const [initialPrompt, setInitialPrompt] = useState<string>("");
  const generationStartedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleInitialGeneration = async (
    id: string,
    updateTerminalOutput: (content: string, isNewMessage?: boolean) => void,
    setThinkingTime: (value: React.SetStateAction<number>) => void,
    setGenerationInProgress: (value: boolean) => void,
    imageUrl: string,
    gameType: string,
    fetchGame: () => Promise<boolean>
  ) => {
    try {
      if (!id) return;
      
      setThinkingTime(0);
      setGenerationInProgress(true);
      
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('prompt, type')
        .eq('id', id)
        .single();
        
      if (gameError) throw gameError;
      if (!gameData) throw new Error("Content not found");
      
      const prompt = gameData.prompt;
      const contentType = gameData.type || gameType;
      
      setInitialPrompt(prompt);
      
      updateTerminalOutput(`> Generating content with prompt: "${prompt}"`, true);
      updateTerminalOutput(`> Content type: ${contentType}`, true);
      
      if (imageUrl) {
        updateTerminalOutput("> Including image with request", true);
      }
      
      updateTerminalOutput("> Connecting to AI service...", true);
      
      const response = await fetch(
        'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo',
          },
          body: JSON.stringify({ 
            prompt: `Create a web design prototype with the following requirements. Include responsive design: ${prompt}`, 
            imageUrl: imageUrl || undefined
          }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorJson.error || errorJson.message || 'Unknown error'}`);
        } catch (e) {
          throw new Error(`HTTP error! status: ${response.status}, response: ${errorText.substring(0, 100)}...`);
        }
      }
      
      updateTerminalOutput(`> Connected to generation service, receiving stream...`, true);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      
      let content = '';
      let buffer = '';
      let currentLineContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = new TextDecoder().decode(value);
        buffer += text;
        
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(5));
            
            switch (data.type) {
              case 'message_start':
                updateTerminalOutput("> AI is analyzing your request...", true);
                break;
                
              case 'content_block_start':
                if (data.content_block?.type === 'thinking') {
                  updateTerminalOutput("\n> Thinking phase started...", true);
                }
                break;
                
              case 'content_block_delta':
                if (data.delta?.type === 'thinking_delta') {
                  const thinking = data.delta.thinking || '';
                  if (thinking && thinking.trim()) {
                    updateTerminalOutput(`> ${thinking}`, true);
                  }
                } else if (data.delta?.type === 'text_delta') {
                  const contentChunk = data.delta.text || '';
                  if (contentChunk) {
                    content += contentChunk;
                    
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
                  updateTerminalOutput(`> Content generation ${data.delta.stop_reason}`, true);
                }
                break;
                
              case 'message_stop':
                updateTerminalOutput("> Content generation completed!", true);
                break;
                
              case 'error':
                throw new Error(data.error?.message || 'Unknown error in stream');
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e);
            updateTerminalOutput(`> Error: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
          }
        }
      }
      
      if (!content) {
        throw new Error("No content received");
      }

      updateTerminalOutput("> Saving to database...", true);
      
      if (contentType === 'svg' && !content.includes('<!DOCTYPE html>')) {
        content = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    svg { max-width: 100%; max-height: 100vh; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
      }
      
      const { error: updateGameError } = await supabase
        .from('games')
        .update({ 
          code: content,
          instructions: "Content generated successfully"
        })
        .eq('id', id);
        
      if (updateGameError) throw updateGameError;
      
      const { error: updateVersionError } = await supabase
        .from('game_versions')
        .update({
          code: content,
          instructions: "Content generated successfully"
        })
        .eq('game_id', id)
        .eq('version_number', 1);
        
      if (updateVersionError) throw updateVersionError;
      
      const { data: existingMessages } = await supabase
        .from('game_messages')
        .select('id')
        .eq('game_id', id)
        .limit(1);
        
      if (!existingMessages || existingMessages.length === 0) {
        const { error: messageError } = await supabase
          .from('game_messages')
          .insert([{
            game_id: id,
            message: prompt,
            response: "Content generated successfully",
            image_url: imageUrl || null
          }]);
          
        if (messageError) {
          console.error("Error saving initial message:", messageError);
        } else {
          updateTerminalOutput("> Initial message saved to chat", true);
        }
      }
      
      updateTerminalOutput("> Generation complete! Displaying result...", true);
      
      setGenerationInProgress(false);
      
      fetchGame();
      
      navigate(`/play/${id}`, { replace: true });
      
    } catch (error) {
      console.error('Generation error:', error);
      
      updateTerminalOutput(`> Error: ${error instanceof Error ? error.message : "Generation failed"}`, true);
      updateTerminalOutput("> Attempting to recover...", true);
      
      fetchGame();
      
      toast({
        title: "Error generating content",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  return {
    initialPrompt,
    generationStartedRef,
    handleInitialGeneration
  };
}
