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
  const [initialPrompt, setInitialPrompt] = useState<string>("");
  const thinkingTimerRef = useRef<NodeJS.Timeout>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const generationStartedRef = useRef(false);
  const lastOutputRef = useRef<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (isGenerating && id && !generationStartedRef.current) {
      generationStartedRef.current = true;
      handleInitialGeneration();
    }
  }, [isGenerating, id]);

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

  const updateTerminalOutput = (newContent: string, isNewMessage = false) => {
    setTerminalOutput(prev => {
      if (isNewMessage || 
          newContent.startsWith("> Thinking:") || 
          newContent.startsWith("> Generation") || 
          newContent.includes("completed") || 
          newContent.includes("Error:")) {
        lastOutputRef.current = newContent;
        return [...prev, newContent];
      }
      
      if (prev.length > 0) {
        const lastLine = prev[prev.length - 1];
        
        if (lastLine.startsWith("> ") && !lastLine.startsWith("> Thinking:") && 
            newContent.startsWith("> ") && !newContent.startsWith("> Thinking:")) {
          const updatedLastLine = lastLine + newContent.slice(1);
          lastOutputRef.current = updatedLastLine;
          return [...prev.slice(0, -1), updatedLastLine];
        }
      }
      
      lastOutputRef.current = newContent;
      return [...prev, newContent];
    });
  };

  const handleInitialGeneration = async () => {
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

  const fetchGame = async () => {
    try {
      const { data, error } = await supabase.from('games').select(`
          id,
          current_version,
          prompt,
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
      
      setInitialPrompt(data.prompt);
      
      const sortedVersions = data.game_versions.sort((a, b) => b.version_number - a.version_number);
      setGameVersions(sortedVersions);
      
      if (sortedVersions.length > 0) {
        setSelectedVersion(sortedVersions[0].id);
        console.log("Selected latest version:", sortedVersions[0].version_number);
        
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
      setShowGenerating(true);
      
      const newVersionNumber = gameVersions.length > 0 ? gameVersions[0].version_number + 1 : 1;
      
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
      
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          current_version: newVersionNumber,
          code: newCode,
          instructions: newInstructions
        })
        .eq('id', id);
        
      if (gameError) throw gameError;
      
      const newVersion: GameVersion = {
        id: versionData.id,
        version_number: versionData.version_number,
        code: versionData.code,
        instructions: versionData.instructions,
        created_at: versionData.created_at
      };
      
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      
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
      const highestVersionNumber = gameVersions.length > 0 
        ? Math.max(...gameVersions.map(v => v.version_number))
        : 0;
      
      const newVersionNumber = highestVersionNumber + 1;
      
      const { data: newVersionData, error: versionError } = await supabase
        .from('game_versions')
        .insert({
          game_id: id,
          version_number: newVersionNumber,
          code: version.code,
          instructions: `Reverted to version ${version.version_number}`
        })
        .select()
        .single();
      
      if (versionError) throw versionError;
      if (!newVersionData) throw new Error("Failed to create new version");
      
      const { error: updateError } = await supabase
        .from('games')
        .update({
          current_version: newVersionNumber,
          code: version.code,
          instructions: `Reverted to version ${version.version_number}`
        })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      const newVersion: GameVersion = {
        id: newVersionData.id,
        version_number: newVersionData.version_number,
        code: newVersionData.code,
        instructions: newVersionData.instructions,
        created_at: newVersionData.created_at
      };
      
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      
    } catch (error) {
      console.error("Error reverting version:", error);
      toast({
        title: "Error reverting to version",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleRevertToMessageVersion = async (message: any) => {
    if (!gameVersions.length) return;
    
    try {
      const messageTime = new Date(message.created_at).getTime();
      
      const versionsAfterMessage = gameVersions
        .filter(v => new Date(v.created_at).getTime() > messageTime)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      if (versionsAfterMessage.length > 0) {
        await handleRevertToVersion(versionsAfterMessage[0]);
      } else {
        throw new Error("No version found after this message");
      }
    } catch (error) {
      console.error("Error reverting to message version:", error);
    }
  };

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
      <PlayNavbar>
        <GameActions 
          currentVersion={currentVersion}
          showGenerating={showGenerating}
          isLatestVersion={isLatestVersion}
          onRevertToVersion={handleRevertToVersion}
        />
      </PlayNavbar>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[380px] flex flex-col bg-white border-r border-gray-100">
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
              disabled={generationInProgress}
              onRevertToVersion={handleRevertToMessageVersion}
              gameVersions={gameVersions}
              initialMessage={initialPrompt}
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
                    onRevertToVersion={handleRevertToVersion}
                    isLatestVersion={isLatestVersion}
                  />
                )}
              </div>

              <div className="flex-1 bg-white rounded-lg overflow-hidden">
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
