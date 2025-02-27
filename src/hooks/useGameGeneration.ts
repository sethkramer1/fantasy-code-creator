
import { useState, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { contentTypes } from "@/types/game";

export const useGameGeneration = () => {
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const generateGame = async (prompt: string, gameType: string) => {
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

    setLoading(true);
    setShowTerminal(true);
    setTerminalOutput([`> Starting generation with prompt: "${prompt}"`]);
    
    let gameContent = '';
    let currentThinking = '';

    try {
      const selectedType = contentTypes.find(type => type.id === gameType);
      if (!selectedType) throw new Error("Invalid content type selected");

      const enhancedPrompt = selectedType.promptPrefix + " " + prompt;

      const response = await fetch(
        'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo',
          },
          body: JSON.stringify({ prompt: enhancedPrompt }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            if (!line.startsWith('data: ')) continue;
            
            const data = JSON.parse(line.slice(5));

            switch (data.type) {
              case 'message_start':
                setTerminalOutput(prev => [...prev, "> AI is analyzing your request..."]);
                break;

              case 'content_block_start':
                if (data.content_block?.type === 'thinking') {
                  setTerminalOutput(prev => [...prev, "\n> Thinking phase started..."]);
                  currentThinking = '';
                }
                break;

              case 'content_block_delta':
                if (data.delta?.type === 'thinking_delta') {
                  const thinking = data.delta.thinking || '';
                  if (thinking && thinking !== currentThinking) {
                    currentThinking = thinking;
                    setTerminalOutput(prev => [...prev, `> ${thinking}`]);
                  }
                } else if (data.delta?.type === 'text_delta') {
                  const content = data.delta.text || '';
                  if (content) {
                    gameContent += content;
                    setTerminalOutput(prev => [...prev, `> Generated ${content.length} characters of game code`]);
                  }
                }
                break;

              case 'content_block_stop':
                if (currentThinking) {
                  setTerminalOutput(prev => [...prev, "> Thinking phase completed"]);
                  currentThinking = '';
                }
                break;

              case 'message_delta':
                if (data.delta?.stop_reason) {
                  setTerminalOutput(prev => [...prev, `> Generation ${data.delta.stop_reason}`]);
                }
                break;

              case 'message_stop':
                setTerminalOutput(prev => [...prev, "> Game generation completed!"]);
                break;

              case 'error':
                throw new Error(data.error?.message || 'Unknown error in stream');
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e);
            setTerminalOutput(prev => [...prev, `> Error: ${e instanceof Error ? e.message : 'Unknown error'}`]);
          }
        }
      }

      if (!gameContent) {
        throw new Error("No content received");
      }

      // For SVG content type, wrap the SVG in basic HTML if it's just raw SVG
      if (selectedType?.id === 'svg' && !gameContent.includes('<!DOCTYPE html>')) {
        gameContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    svg { max-width: 100%; max-height: 100vh; }
  </style>
</head>
<body>
  ${gameContent}
</body>
</html>`;
      }

      setTerminalOutput(prev => [...prev, "> Saving to database..."]);

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert([{ 
          prompt: prompt,
          code: gameContent,
          instructions: "Content generated successfully",
          current_version: 1,
          type: selectedType.id
        }])
        .select()
        .single();

      if (gameError) throw gameError;
      if (!gameData) throw new Error("Failed to save content");

      const { error: versionError } = await supabase
        .from('game_versions')
        .insert([{
          game_id: gameData.id,
          code: gameContent,
          instructions: "Content generated successfully",
          version_number: 1
        }]);

      if (versionError) throw versionError;
      
      setTerminalOutput(prev => [...prev, "> Saved successfully! Redirecting..."]);
      
      return gameData;

    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Error generating content",
        description: error instanceof Error ? error.message : "Please try again",
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
    generateGame,
    timerRef
  };
};
