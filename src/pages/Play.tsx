
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { GamePreview } from "@/components/game-player/GamePreview";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { processGameUpdate } from "@/components/game-chat/api-service";
import { Message } from "@/components/game-chat/types";

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

// Ensure that when we generate a placeholder message it follows the Message type
const generatePlaceholderMessage = (initialPrompt: string): Message => {
  return {
    id: 'initial-message',
    message: initialPrompt,
    created_at: new Date().toISOString(),
    response: "Generating initial content..."
  };
};

const Play = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [game, setGame] = useState<{
    id: string;
    code: string;
    instructions: string | null;
    current_version: number | null;
    prompt: string;
  } | null>(null);
  const [currentVersion, setCurrentVersion] = useState<GameVersion | undefined>(undefined);
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [thinkingTime, setThinkingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const generating = searchParams.get("generating") === "true";
  const initialType = searchParams.get("type") || "webdesign";
  const initialModelType = searchParams.get("modelType") || "smart";
  const initialImageUrl = searchParams.get("imageUrl") || "";
  const initialPrompt = game?.prompt || "Loading...";

  useEffect(() => {
    if (generating && gameId) {
      setGenerationInProgress(true);
      // Start with a placeholder message
      setTerminalOutput([`> Generating initial content...`]);
    }
  }, [generating, gameId]);

  useEffect(() => {
    if (generationInProgress && gameId) {
      // Start the timer when generation starts
      setThinkingTime(0);
      timerRef.current = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      // Clear the timer when generation is complete or stopped
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [generationInProgress]);

  useEffect(() => {
    const fetchInitialContent = async () => {
      if (gameId && generating) {
        try {
          const { apiResponse, modelType } = await processGameUpdate(
            gameId,
            initialPrompt,
            initialModelType,
            initialImageUrl,
            (text, isNewMessage) => {
              setTerminalOutput(prev => {
                const newOutput = isNewMessage ? [...prev, text] : [...prev.slice(0, -1), text];
                return newOutput;
              });
            }
          );

          if (apiResponse && modelType === "smart") {
            const reader = apiResponse.body?.getReader();
            if (!reader) {
              throw new Error("ReadableStream not supported in this browser.");
            }

            let partialResponse = "";
            let decoder = new TextDecoder();

            const processStream = async () => {
              try {
                let result;
                do {
                  result = await reader.read();
                  if (result.value) {
                    partialResponse += decoder.decode(result.value);
                    // Split by double newline to delineate messages
                    const messages = partialResponse.split("\n\n");
                    // Update terminal output with each message
                    messages.forEach((message, index) => {
                      if (message) {
                        setTerminalOutput(prev => {
                          const newOutput = [...prev.slice(0, -1), message];
                          return newOutput;
                        });
                      }
                    });
                    partialResponse = messages[messages.length - 1] || "";
                  }
                } while (!result.done);

                // Handle the last part of the response
                if (partialResponse) {
                  setTerminalOutput(prev => [...prev, partialResponse]);
                }
              } catch (e) {
                console.error("Streaming error:", e);
                toast({
                  title: "Error during content generation",
                  description: e instanceof Error ? e.message : "An unexpected error occurred",
                  variant: "destructive",
                });
              } finally {
                setGenerationInProgress(false);
                reader.releaseLock();
              }
            };

            processStream();
          } else {
            setGenerationInProgress(false);
          }
        } catch (error) {
          console.error("Error during initial content fetch:", error);
          toast({
            title: "Error during content generation",
            description: error instanceof Error ? error.message : "An unexpected error occurred",
            variant: "destructive",
          });
          setGenerationInProgress(false);
        }
      }
    };

    fetchInitialContent();
  }, [gameId, generating, initialPrompt, initialType, initialModelType, initialImageUrl, toast]);

  const fetchGame = async () => {
    if (!gameId) return;

    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        console.error("Error fetching game:", gameError);
        toast({
          title: "Error fetching game",
          description: gameError.message,
          variant: "destructive",
        });
        return;
      }

      if (!gameData) {
        toast({
          title: "Game not found",
          description: "The requested game does not exist.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setGame(gameData);

      const { data: versionData, error: versionError } = await supabase
        .from('game_versions')
        .select('*')
        .eq('game_id', gameId)
        .order('version_number', { ascending: false });

      if (versionError) {
        console.error("Error fetching game versions:", versionError);
        toast({
          title: "Error fetching game versions",
          description: versionError.message,
          variant: "destructive",
        });
        return;
      }

      setGameVersions(versionData);
      setCurrentVersion(versionData[0]);
    } catch (error) {
      console.error("Error fetching game data:", error);
      toast({
        title: "Error fetching game data",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchGame();
  }, [gameId, navigate, toast]);

  const handleGameUpdate = async (newCode: string, newInstructions: string) => {
    if (!gameId) return;

    try {
      // Determine the next version number
      const nextVersionNumber = gameVersions.length > 0 ? Math.max(...gameVersions.map(v => v.version_number)) + 1 : 1;

      // Insert the new version into the game_versions table
      const { data: newVersion, error: newVersionError } = await supabase
        .from('game_versions')
        .insert([{
          game_id: gameId,
          code: newCode,
          instructions: newInstructions,
          version_number: nextVersionNumber
        }])
        .select()
        .single();

      if (newVersionError) {
        console.error("Error saving new game version:", newVersionError);
        toast({
          title: "Error saving new game version",
          description: newVersionError.message,
          variant: "destructive",
        });
        return;
      }

      // Update the game with the new code and instructions
      const { error: updateError } = await supabase
        .from('games')
        .update({
          code: newCode,
          instructions: newInstructions,
          current_version: nextVersionNumber
        })
        .eq('id', gameId);

      if (updateError) {
        console.error("Error updating game:", updateError);
        toast({
          title: "Error updating game",
          description: updateError.message,
          variant: "destructive",
        });
        return;
      }

      // Optimistically update the local state
      const updatedGame = {
        ...game!,
        code: newCode,
        instructions: newInstructions,
        current_version: nextVersionNumber
      };
      setGame(updatedGame);

      // Fetch the updated game versions
      fetchGame();

      toast({
        title: "Game updated",
        description: "The game has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating game:", error);
      toast({
        title: "Error updating game",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleTerminalStatusChange = (showing: boolean, output: string[], thinking: number, isLoading: boolean) => {
    setShowTerminal(showing);
    setTerminalOutput(output);
    setThinkingTime(thinking);
    setGenerationInProgress(isLoading);
  };

  const revertToMessageVersion = async (message: Message) => {
    try {
      if (!message.version_id) {
        toast({
          title: "Cannot revert to this version",
          description: "This message doesn't have an associated version",
          variant: "destructive"
        });
        return;
      }

      const { data: versionData, error: versionError } = await supabase
        .from('game_versions')
        .select('*')
        .eq('id', message.version_id)
        .single();

      if (versionError || !versionData) {
        console.error("Error fetching version data:", versionError);
        toast({
          title: "Error reverting to version",
          description: "Could not find the version data",
          variant: "destructive"
        });
        return;
      }

      // Update the game with this version
      const { error: updateError } = await supabase
        .from('games')
        .update({
          code: versionData.code,
          instructions: versionData.instructions,
          current_version: versionData.version_number
        })
        .eq('id', gameId);

      if (updateError) {
        console.error("Error updating game:", updateError);
        toast({
          title: "Error reverting to version",
          description: updateError.message,
          variant: "destructive"
        });
        return;
      }

      // Refresh game data
      fetchGame();
      
      toast({
        title: "Success",
        description: `Reverted to version from ${new Date(message.created_at).toLocaleString()}`,
      });
    } catch (error) {
      console.error("Error in revertToMessageVersion:", error);
      toast({
        title: "Error",
        description: "Failed to revert to the selected version",
        variant: "destructive"
      });
    }
  };

  if (!gameId || !game) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <PlayNavbar
        gameId={gameId}
        gameName={game.prompt}
        showCodeEditor={showCode}
        onShowCodeEditorChange={setShowCode}
        onExport={() => {
          // handleExport(game.code);
        }}
        onDownload={() => {
          // handleDownload(game.code);
        }}
        onFork={() => {
          // handleFork(game.code);
        }}
        onShare={() => {
          // handleShare(game.code);
        }}
      />

      <div className="flex flex-grow">
        <GamePreview
          currentVersion={currentVersion}
          showCode={showCode}
          ref={iframeRef}
        />

        <SidebarChat
          gameId={gameId}
          generationInProgress={generationInProgress}
          onGameUpdate={handleGameUpdate}
          onTerminalStatusChange={handleTerminalStatusChange}
          onRevertToMessageVersion={revertToMessageVersion}
          gameVersions={gameVersions}
          initialPrompt={initialPrompt}
        />
      </div>

      <GenerationTerminal
        open={showTerminal}
        onOpenChange={setShowTerminal}
        output={terminalOutput}
        thinkingTime={thinkingTime}
        loading={generationInProgress}
      />
    </div>
  );
};

export default Play;
