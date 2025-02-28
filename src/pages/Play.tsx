
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
  const lastOutputRef = useRef<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();

  // Start timer for thinking time for initial generation
  useEffect(() => {
    console.log("Initial generation timer effect, in progress:", generationInProgress);
    
    if (generationInProgress) {
      console.log("Starting main thinking timer");
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
      
      thinkingTimerRef.current = setInterval(() => {
        setThinkingTime(prev => {
          const newTime = prev + 1;
          console.log("Main thinking time incremented to:", newTime);
          return newTime;
        });
      }, 1000);
    } else {
      console.log("Clearing main thinking timer");
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

  // Helper function to update terminal output without always creating new lines
  const updateTerminalOutput = (newContent: string, isNewMessage = false) => {
    setTerminalOutput(prev => {
      // Handle special case content that should always be on a new line
      if (isNewMessage || 
          newContent.startsWith("> Thinking:") || 
          newContent.startsWith("> Generation") || 
          newContent.includes("completed") || 
          newContent.includes("Error:")) {
        lastOutputRef.current = newContent;
        return [...prev, newContent];
      }
      
      // Otherwise, try to append to the last line if it's code content
      if (prev.length > 0) {
        const lastLine = prev[prev.length - 1];
        
        // If both are code content (indicated by ">"), combine them
        if (lastLine.startsWith("> ") && !lastLine.startsWith("> Thinking:") && 
            newContent.startsWith("> ") && !newContent.startsWith("> Thinking:")) {
          
          // Strip the ">" prefix from the new content when combining
          const updatedLastLine = lastLine + newContent.slice(1);
          lastOutputRef.current = updatedLastLine;
          return [...prev.slice(0, -1), updatedLastLine];
        }
      }
      
      // Default: add as new line
      lastOutputRef.current = newContent;
      return [...prev, newContent];
    });
  };

  const handleInitialGeneration = async () => {
    try {
      if (!id) return;
      
      // Reset thinking time when starting generation
      setThinkingTime(0);
      setGenerationInProgress(true);
      
      // Get game details to get the prompt
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('prompt, type')
        .eq('id', id)
        .single();
        
      if (gameError) throw gameError;
      if (!gameData) throw new Error("Content not found");
      
      const prompt = gameData.prompt;
      const contentType = gameData.type || gameType;
      
      // Update terminal with prompt info
      updateTerminalOutput(`> Generating content with prompt: "${prompt}"`, true);
      updateTerminalOutput(`> Content type: ${contentType}`, true);
      
      if (imageUrl) {
        updateTerminalOutput("> Including image with request", true);
      }
      
      // Call the generation API directly
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
                    
                    // Handle newlines in content specially
                    if (contentChunk.includes('\n')) {
                      // Split by newlines and process each part
                      const lines = contentChunk.split('\n');
                      
                      // Add first part to current line
                      if (lines[0]) {
                        currentLineContent += lines[0];
                        updateTerminalOutput(`> ${currentLineContent}`, false);
                      }
                      
                      // Handle middle parts - each gets its own line
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
                      // No newlines, append to current line
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
      
      // For SVG content type, wrap the SVG in basic HTML if it's just raw SVG
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
      
      // Update the database with generated content
      const { error: updateGameError } = await supabase
        .from('games')
        .update({ 
          code: content,
          instructions: "Content generated successfully"
        })
        .eq('id', id);
        
      if (updateGameError) throw updateGameError;
      
      // Update the version with the generated content
      const { error: updateVersionError } = await supabase
        .from('game_versions')
        .update({
          code: content,
          instructions: "Content generated successfully"
        })
        .eq('game_id', id)
        .eq('version_number', 1);
        
      if (updateVersionError) throw updateVersionError;
      
      // Add initial message if it doesn't exist
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
      
      // Set generation as complete and load the result
      setGenerationInProgress(false);
      
      // Refresh data to show the generated content
      fetchGame();
      
      // Remove the generating parameter from URL
      navigate(`/play/${id}`, { replace: true });
      
      toast({
        title: "Generation complete!",
        description: "Your content has been generated successfully."
      });
      
    } catch (error) {
      console.error('Generation error:', error);
      
      updateTerminalOutput(`> Error: ${error instanceof Error ? error.message : "Generation failed"}`, true);
      updateTerminalOutput("> Attempting to recover...", true);
      
      // Even if there's an error, try to load the content
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
      if (!data) throw new Error("Content not found");
      
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
        title: "Error loading content",
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
    console.log("Terminal status change:", { showing, thinking, isLoading });
    
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
      
      // Update the current version
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
        title: "Content updated successfully",
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
      
      // Update the current version
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
    <div className="flex flex-col h-screen bg-white">
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
        <div className="w-[400px] flex flex-col bg-white border-r border-gray-100">
          <div className="p-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center">
              <h2 className="text-lg font-medium text-black">Modify Content</h2>
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
            <div className="glass-panel bg-white border border-gray-100 rounded-xl p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
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
