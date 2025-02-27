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

  const generateGame = async (prompt: string, gameType: string, imageUrl?: string) => {
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

      // Add content type specific system instructions
      let systemInstructions = "";
      switch (selectedType.id) {
        case 'game':
          systemInstructions = `
GAME STRUCTURE REQUIREMENTS:
1. Game Logic:
- Use a proper Game class/object to encapsulate all game logic
- Implement clear game states: loading, playing, paused, game over
- All variables must be properly scoped (no globals)
- Use requestAnimationFrame for the game loop
- Include proper event cleanup on game over/restart

2. Core Functionality:
- Start button must initialize game state and assets properly
- Event listeners must be added AND removed appropriately
- Mobile touch events must have proper touch handling (min 44x44px touch areas)
- Score/lives must persist correctly between game states
- Pause functionality must properly freeze game state
- Add console.logs for key game events (start, score changes, game over)

3. Error Prevention:
- Check for undefined game objects before use
- Implement bounds checking for all game entities
- Add frame rate management
- Include checks for browser compatibility features
- Add try-catch blocks around critical game functions

4. User Experience:
- Show clear loading states for assets
- Display game instructions before starting
- Provide visual feedback for ALL player actions
- Show clear game over state with final score
- Include restart functionality
- Add hover/active states for interactive elements
- Load sound effects only after user interaction
- Ensure the game starts when the user presses start

5. Mobile Support:
- Implement responsive design that works on all screen sizes
- Prevent touch events from interfering with page scroll when game is inactive
- Position controls for comfortable thumb reach
- Optimize performance for mobile devices
- Handle device orientation changes gracefully

6. Documentation:
- Add clear comments for game initialization, update, and render functions
- Use descriptive variable and function names
- Document game states and transitions
- Include performance considerations

7. Sizing
- Build a responsive canvas that fits within all iframes.`;
          break;
        case 'svg':
          systemInstructions = `
SVG REQUIREMENTS:
1. Structure:
- Use proper SVG namespace
- Implement clean, semantic element structure
- Optimize paths and shapes
- Use appropriate viewBox dimensions
- Include proper metadata

2. Styling:
- Use efficient CSS styling
- Implement proper fill and stroke attributes
- Use transforms where appropriate
- Add animations if specified
- Include responsive scaling

3. Optimization:
- Minimize path points
- Remove unnecessary attributes
- Use appropriate precision
- Implement proper grouping
- Clean and format code`;
          break;
        case 'webdesign':
          systemInstructions = `
WEB DESIGN REQUIREMENTS:
1. Structure:
- Use semantic HTML5 elements
- Implement proper heading hierarchy
- Include meta tags
- Add responsive viewport settings
- Use proper document structure

2. Styling:
- Implement mobile-first responsive design
- Use modern CSS features
- Include hover and focus states
- Add smooth transitions
- Support dark/light modes

3. Components:
- Create reusable components
- Add proper spacing
- Include loading states
- Implement error states
- Use consistent styling

4. Accessibility:
- Add ARIA labels
- Use semantic HTML
- Include keyboard navigation
- Implement proper color contrast
- Add focus indicators`;
          break;
        case 'dataviz':
          systemInstructions = `
DATA VISUALIZATION REQUIREMENTS:
1. Structure:
- Use appropriate chart type
- Implement proper axes
- Add clear labels
- Include legends where needed
- Use responsive sizing

2. Interaction:
- Add hover states
- Include tooltips
- Implement zooming if needed
- Add click interactions
- Support touch devices

3. Accessibility:
- Add ARIA labels
- Include alt text
- Support keyboard navigation
- Use proper color contrast
- Add screen reader support`;
          break;
        case 'diagram':
          systemInstructions = `
DIAGRAM REQUIREMENTS:
1. Structure:
- Use clear layout
- Implement proper spacing
- Add directional indicators
- Include proper labels
- Use consistent styling

2. Components:
- Create clear nodes
- Add proper connections
- Include labels
- Use appropriate icons
- Implement grouping

3. Styling:
- Use consistent colors
- Add proper spacing
- Include hover states
- Implement highlights
- Use appropriate fonts`;
          break;
        case 'infographic':
          systemInstructions = `
INFOGRAPHIC REQUIREMENTS:
1. Structure:
- Use clear sections
- Implement proper flow
- Add visual hierarchy
- Include proper spacing
- Use consistent layout

2. Content:
- Create clear headings
- Add proper icons
- Include data visualizations
- Use appropriate typography
- Implement consistent styling

3. Accessibility:
- Add alt text
- Use proper contrast
- Include screen reader support
- Implement proper spacing
- Use semantic structure`;
          break;
        default:
          systemInstructions = "Create content based on the user's requirements with clean, maintainable code.";
      }

      // Combine the system instructions with the enhanced prompt and image URL
      const finalPrompt = `${systemInstructions}\n\n${enhancedPrompt}`;

      const response = await fetch(
        'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo',
          },
          body: JSON.stringify({ 
            prompt: finalPrompt,
            imageUrl: imageUrl 
          }),
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
    setThinkingTime,
    generateGame,
    timerRef
  };
};
