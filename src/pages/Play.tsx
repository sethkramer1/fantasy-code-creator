
import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { GameChat } from "@/components/GameChat";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { GameActions } from "@/components/game-player/GameActions";
import { VersionSelector } from "@/components/game-player/VersionSelector";
import { ViewToggle } from "@/components/game-player/ViewToggle";
import { GamePreview } from "@/components/game-player/GamePreview";

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

const Play = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isGenerating = searchParams.get('generating') === 'true';
  const gameType = searchParams.get('type') || '';
  const encodedImageUrl = searchParams.get('imageUrl') || '';
  const imageUrl = encodedImageUrl ? decodeURIComponent(encodedImageUrl) : '';
  
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [showGenerating, setShowGenerating] = useState(isGenerating);
  const [generationInProgress, setGenerationInProgress] = useState(isGenerating);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "> Starting generation process...", 
    "> Creating your design based on your prompt..."
  ]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const thinkingTimerRef = useRef<NodeJS.Timeout>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const generationStartedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Start timer for thinking time
  useEffect(() => {
    if (generationInProgress) {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
      
      thinkingTimerRef.current = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    }
    
    return () => {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    };
  }, [generationInProgress]);

  // Start generation if we're in generating mode
  useEffect(() => {
    if (isGenerating && id && !generationStartedRef.current) {
      generationStartedRef.current = true;
      handleInitialGeneration();
    }
  }, [isGenerating, id]);

  // Prevent keyboard events from being captured by the iframe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "PageUp", "PageDown", "Home", "End"].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  const handleInitialGeneration = async () => {
    try {
      if (!id) return;
      
      // Get game details to get the prompt
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('prompt, type')
        .eq('id', id)
        .single();
        
      if (gameError) throw gameError;
      if (!gameData) throw new Error("Game not found");
      
      const prompt = gameData.prompt;
      const contentType = gameData.type || gameType;
      
      // Update terminal with prompt info
      setTerminalOutput(prev => [
        ...prev, 
        `> Generating content with prompt: "${prompt}"`,
        `> Content type: ${contentType}`
      ]);
      
      if (imageUrl) {
        setTerminalOutput(prev => [...prev, "> Including image with request"]);
      }
      
      // Call the generation API directly
      setTerminalOutput(prev => [...prev, "> Connecting to AI service..."]);
      
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
      
      setTerminalOutput(prev => [...prev, `> Connected to generation service, receiving stream...`]);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      
      let gameContent = '';
      let buffer = '';
      
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

      setTerminalOutput(prev => [...prev, "> Saving to database..."]);
      
      // For SVG content type, wrap the SVG in basic HTML if it's just raw SVG
      if (contentType === 'svg' && !gameContent.includes('<!DOCTYPE html>')) {
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
      
      // Update the game with generated content
      const { error: updateGameError } = await supabase
        .from('games')
        .update({ 
          code: gameContent,
          instructions: "Content generated successfully"
        })
        .eq('id', id);
        
      if (updateGameError) throw updateGameError;
      
      // Update the game version with the generated content
      const { error: updateVersionError } = await supabase
        .from('game_versions')
        .update({
          code: gameContent,
          instructions: "Content generated successfully"
        })
        .eq('game_id', id)
        .eq('version_number', 1);
        
      if (updateVersionError) throw updateVersionError;
      
      // Add initial message to game_messages if it doesn't exist
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
          setTerminalOutput(prev => [...prev, "> Initial message saved to chat"]);
        }
      }
      
      setTerminalOutput(prev => [...prev, "> Generation complete! Displaying result..."]);
      
      // Set generation as complete and load the result
      setGenerationInProgress(false);
      
      // Refresh game data to show the generated content
      fetchGame();
      
      // Remove the generating parameter from URL
      navigate(`/play/${id}`, { replace: true });
      
      toast({
        title: "Generation complete!",
        description: "Your content has been generated successfully."
      });
      
    } catch (error) {
      console.error('Generation error:', error);
      
      setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : "Generation failed"}`]);
      setTerminalOutput(prev => [...prev, "> Attempting to recover..."]);
      
      // Even if there's an error, try to load the game
      fetchGame();
      
      toast({
        title: "Error generating content",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const fetchGame = async () => {
    try {
      const { data, error } = await supabase.from('games').select(`
          id,
          current_version,
          game_versions (
            id,
            version_number,
            code,
            instructions,
            created_at
          )
        `).eq('id', id).single();
      if (error) throw error;
      if (!data) throw new Error("Game not found");
      
      // Sort versions by version_number in descending order (latest first)
      const sortedVersions = data.game_versions.sort((a, b) => b.version_number - a.version_number);
      setGameVersions(sortedVersions);
      
      // Always select the latest version (first in the sorted array)
      if (sortedVersions.length > 0) {
        setSelectedVersion(sortedVersions[0].id);
        console.log("Selected latest version:", sortedVersions[0].version_number);
        
        // If the code is no longer "Generating...", hide the generation UI
        if (sortedVersions[0].code !== "Generating...") {
          setShowGenerating(false);
          setGenerationInProgress(false);
        }
      }
    } catch (error) {
      toast({
        title: "Error loading game",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGame();
  }, [id, toast]);

  useEffect(() => {
    if (!loading && iframeRef.current) {
      iframeRef.current.focus();
      
      // Set up message event listener for communication with iframe
      const handleIframeMessage = (event: MessageEvent) => {
        if (event.source === iframeRef.current?.contentWindow) {
          console.log('Message from iframe:', event.data);
        }
      };
      
      window.addEventListener('message', handleIframeMessage);
      return () => {
        window.removeEventListener('message', handleIframeMessage);
      };
    }
  }, [loading, selectedVersion]);

  // Handle terminal status updates from GameChat
  const handleTerminalStatusChange = (showing: boolean, output: string[], thinking: number, isLoading: boolean) => {
    if (showing) {
      setShowGenerating(true);
      setGenerationInProgress(isLoading);
      setTerminalOutput(output);
      setThinkingTime(thinking);
    } else {
      setShowGenerating(false);
      setGenerationInProgress(false);
    }
  };

  const handleGameUpdate = async (newCode: string, newInstructions: string) => {
    try {
      // Show generation UI
      setShowGenerating(true);
      
      // Create a new version with incremented version number
      const newVersionNumber = gameVersions.length > 0 ? gameVersions[0].version_number + 1 : 1;
      
      // Insert the new version into database
      const { data: versionData, error: versionError } = await supabase
        .from('game_versions')
        .insert({
          game_id: id,
          version_number: newVersionNumber,
          code: newCode,
          instructions: newInstructions
        })
        .select()
        .single();
        
      if (versionError) throw versionError;
      if (!versionData) throw new Error("Failed to save new version");
      
      // Update the game's current version
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          current_version: newVersionNumber,
          code: newCode,
          instructions: newInstructions
        })
        .eq('id', id);
        
      if (gameError) throw gameError;
      
      // Add the new version to state and select it
      const newVersion: GameVersion = {
        id: versionData.id,
        version_number: versionData.version_number,
        code: versionData.code,
        instructions: versionData.instructions,
        created_at: versionData.created_at
      };
      
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      
      toast({
        title: "Code updated successfully",
        description: `Version ${newVersionNumber} has been created and set as current.`
      });
      
    } catch (error) {
      console.error("Error saving new version:", error);
      setShowGenerating(false);
      toast({
        title: "Error saving version",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersion(versionId);
  };

  const handleRevertToVersion = async (version: GameVersion) => {
    try {
      const newVersion: GameVersion = {
        id: crypto.randomUUID(),
        version_number: gameVersions[0].version_number + 1,
        code: version.code,
        instructions: version.instructions,
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('game_versions').insert({
        id: newVersion.id,
        game_id: id,
        version_number: newVersion.version_number,
        code: newVersion.code,
        instructions: newVersion.instructions
      });
      if (error) throw error;
      
      // Update the game's current version
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          current_version: newVersion.version_number,
          code: newVersion.code,
          instructions: newVersion.instructions
        })
        .eq('id', id);
        
      if (gameError) throw gameError;
      
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      toast({
        title: "Version reverted",
        description: `Created new version ${newVersion.version_number} based on version ${version.version_number}`
      });
    } catch (error) {
      toast({
        title: "Error reverting version",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  };

  // Compute currentVersion and isLatestVersion
  const currentVersion = gameVersions.find(v => v.id === selectedVersion);
  const isLatestVersion = currentVersion?.version_number === gameVersions[0]?.version_number;

  if (loading && !showGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F5]">
      {/* Navbar */}
      <PlayNavbar>
        <GameActions 
          currentVersion={currentVersion}
          showGenerating={showGenerating}
          isLatestVersion={isLatestVersion}
          onRevertToVersion={handleRevertToVersion}
        />
      </PlayNavbar>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[400px] flex flex-col bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center">
              <h2 className="text-lg font-medium text-gray-900">Modify Content</h2>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <GameChat 
              gameId={id!} 
              onGameUpdate={handleGameUpdate} 
              onTerminalStatusChange={handleTerminalStatusChange}
            />
          </div>
        </div>

        <div className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden">
          <div className="max-w-[1200px] mx-auto w-full flex-1 flex flex-col">
            <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                  {!showGenerating && (
                    <ViewToggle showCode={showCode} setShowCode={setShowCode} />
                  )}
                </div>
                
                {!showGenerating && gameVersions.length > 0 && (
                  <VersionSelector 
                    gameVersions={gameVersions}
                    selectedVersion={selectedVersion}
                    onVersionChange={handleVersionChange}
                  />
                )}
              </div>

              <div className="flex-1 bg-white rounded-lg overflow-hidden">
                {/* Show generation terminal when generating */}
                {showGenerating ? (
                  <GenerationTerminal
                    open={true}
                    onOpenChange={() => {}}
                    output={terminalOutput}
                    thinkingTime={thinkingTime}
                    loading={generationInProgress}
                    asModal={false}
                  />
                ) : (
                  <GamePreview 
                    currentVersion={currentVersion} 
                    showCode={showCode} 
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;
