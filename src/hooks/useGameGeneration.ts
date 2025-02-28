
import { useState, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { contentTypes } from "@/types/game";

export const useGameGeneration = () => {
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const generateGame = async (prompt: string, gameType: string, imageUrl?: string, existingGameId?: string) => {
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
    setTerminalOutput([`> Starting generation with prompt: "${prompt}"${imageUrl ? ' (with image)' : ''}`]);
    
    let gameContent = '';
    let buffer = '';

    try {
      const selectedType = contentTypes.find(type => type.id === gameType);
      if (!selectedType) throw new Error("Invalid content type selected");

      const enhancedPrompt = selectedType.promptPrefix + " " + prompt;

      // Add content type specific system instructions
      let systemInstructions = "";
      switch (selectedType.id) {
        case 'game':
          systemInstructions = `
GAME REQUIREMENTS:
1. Structure:
   - Encapsulated Game class with proper states (loading, playing, paused, game over)
   - No global variables, use requestAnimationFrame for game loop
   - Proper event handling and cleanup

2. Core Features:
   - Functional start/pause/restart buttons
   - Persistent score/lives tracking
   - Mobile-friendly touch controls (44px+ touch areas)
   - Simple asset loading with visual indicators that load correctly

3. Quality & UX:
   - Bounds checking and error prevention
   - Clear instructions, feedback, and game states
   - Visual feedback for all player actions
   - Responsive design for all screen sizes
   - NO music or external APIs
   - Handle orientation changes on mobile

4. Code Quality:
   - Descriptive names and comments for key functions
   - Try-catch blocks around critical functions
   - Performance optimization for mobile
   - Canvas that adjusts to iframe container size
   - Self-contained code (no external dependencies)
`;
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
- If the user asks for a mobile design, mobile UI, or anything similar for a mobile device, the design should be wrapped in an iPhone container showing the status bar and home indicator.
 In this case, create a mobile UI design inside an iPhone frame so the user can see what the design mock up looks like in an iphone frame since it is a mobile UI design.
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
- Add focus indicators

5. Container:
- If the user asks for a mobile UI, wrap the design in an iphone container

6. Image Usage:
- When using Unsplash images, ONLY use valid, real Unsplash URLs (https://source.unsplash.com/...)
- Never make up or invent Unsplash image URLs
- If you need a placeholder image, use a proper placeholder service instead of making up an Unsplash URL
`;
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

      // Image usage instructions for all content types
      systemInstructions += `

IMPORTANT IMAGE USAGE INSTRUCTIONS:
- When using Unsplash images, ONLY use valid, real Unsplash URLs (https://source.unsplash.com/...)
- Never make up or invent Unsplash image URLs
- If you need a placeholder image, use a proper placeholder service instead of making up an Unsplash URL
`;

      // Extra emphasis for mobile UI wrapping in iPhone container
      if (selectedType.id === 'webdesign' && 
          (prompt.toLowerCase().includes('mobile') || 
           prompt.toLowerCase().includes('phone') || 
           prompt.toLowerCase().includes('iphone') || 
           prompt.toLowerCase().includes('smartphone'))) {
        const mobileEmphasis = `
IMPORTANT MOBILE INSTRUCTION:
This is a mobile UI design request. You MUST wrap the final design in an iPhone container showing 
the status bar at the top and home indicator at the bottom. The design should appear as if it's 
being displayed on an actual iPhone device to provide proper context for the mobile UI design.

ENSURE INTERACTION CAPABILITIES:
- The content inside the iPhone container MUST be fully functional
- Users should be able to scroll the content if it extends beyond the viewport
- All interactive elements (buttons, links, inputs) should be clickable and functional
- Touch events should work properly on the content within the frame
- Do not add any elements that block or prevent interaction with the content
- Test that the scrolling works by adding sufficient content to require scrolling
- Make sure to use proper overflow settings to enable scrolling
`;
        systemInstructions = mobileEmphasis + systemInstructions;
      }

      // Combine the system instructions with the enhanced prompt and image URL
      const finalPrompt = `${systemInstructions}\n\n${enhancedPrompt}`;
      
      // Log the full length of the system instructions to confirm it's complete
      const instructionsLength = systemInstructions.length;
      setTerminalOutput(prev => [...prev, `> Enhanced prompt created with ${instructionsLength} characters of instructions`]);
      
      // For debugging, log a sample of the beginning of the instructions
      const instructionsSample = systemInstructions.substring(0, 100) + "...";
      setTerminalOutput(prev => [...prev, `> Instructions begin with: "${instructionsSample}"`]);

      // Log if an image is being included
      if (imageUrl) {
        setTerminalOutput(prev => [...prev, `> Including image reference with generation request`]);
      }

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
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorJson.error || errorJson.message || 'Unknown error'}`);
        } catch (e) {
          throw new Error(`HTTP error! status: ${response.status}, response: ${errorText.substring(0, 100)}...`);
        }
      }

      setTerminalOutput(prev => [...prev, `> Connected to generation service, receiving stream...`]);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and add it to our buffer
        const text = new TextDecoder().decode(value);
        buffer += text;
        
        // Process complete lines from the buffer
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(5));

            switch (data.type) {
              case 'message_start':
                setTerminalOutput(prev => [...prev, "> AI is analyzing your request..."]);
                break;

              case 'content_block_start':
                if (data.content_block?.type === 'thinking') {
                  setTerminalOutput(prev => [...prev, "\n> Thinking phase started..."]);
                }
                break;

              case 'content_block_delta':
                if (data.delta?.type === 'thinking_delta') {
                  const thinking = data.delta.thinking || '';
                  if (thinking && thinking.trim()) {
                    setTerminalOutput(prev => [...prev, `> ${thinking}`]);
                  }
                } else if (data.delta?.type === 'text_delta') {
                  const content = data.delta.text || '';
                  if (content) {
                    gameContent += content;
                    
                    // Display the content in smaller chunks for better visibility
                    if (content.includes('\n')) {
                      // If it contains newlines, split it and display each line
                      const contentLines = content.split('\n');
                      for (const contentLine of contentLines) {
                        if (contentLine.trim()) {
                          setTerminalOutput(prev => [...prev, `> ${contentLine}`]);
                        }
                      }
                    } else {
                      // Otherwise display the chunk directly
                      setTerminalOutput(prev => [...prev, `> ${content}`]);
                    }
                  }
                }
                break;

              case 'content_block_stop':
                if (data.content_block?.type === 'thinking') {
                  setTerminalOutput(prev => [...prev, "> Thinking phase completed"]);
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

      let gameData;
      
      if (existingGameId) {
        // Update the existing game record with the actual content
        const { data, error: updateError } = await supabase
          .from('games')
          .update({ 
            code: gameContent,
            instructions: "Content generated successfully",
            current_version: 1,
            type: selectedType.id
          })
          .eq('id', existingGameId)
          .select()
          .single();
          
        if (updateError) throw updateError;
        if (!data) throw new Error("Failed to update game content");
        
        gameData = data;
        
        // Update the version with the actual content
        const { error: versionUpdateError } = await supabase
          .from('game_versions')
          .update({
            code: gameContent,
            instructions: "Content generated successfully"
          })
          .eq('game_id', existingGameId)
          .eq('version_number', 1);
          
        if (versionUpdateError) throw versionUpdateError;
      } else {
        // Create a new game record
        const { data, error: gameError } = await supabase
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
        if (!data) throw new Error("Failed to save content");
        
        gameData = data;

        const { error: versionError } = await supabase
          .from('game_versions')
          .insert([{
            game_id: gameData.id,
            code: gameContent,
            instructions: "Content generated successfully",
            version_number: 1
          }]);

        if (versionError) throw versionError;
      }
      
      // Add initial message to game_messages
      const { error: messageError } = await supabase
        .from('game_messages')
        .insert([{
          game_id: gameData.id,
          message: prompt,
          response: "Content generated successfully",
          image_url: imageUrl
        }]);
        
      if (messageError) {
        console.error("Error saving initial message:", messageError);
      } else {
        setTerminalOutput(prev => [...prev, "> Initial message saved to chat"]);
      }
      
      setTerminalOutput(prev => [...prev, "> Saved successfully!"]);
      
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
    timerRef,
    gameId,
    setGameId
  };
};
