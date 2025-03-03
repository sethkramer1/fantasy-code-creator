
import { useRef, useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { GamePreview } from "@/components/game-player/GamePreview";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { usePlayGameData } from "@/hooks/usePlayGameData";
import { useGameUpdate } from "@/hooks/useGameUpdate";
import { usePlayTerminal } from "@/hooks/usePlayTerminal";
import { useToast } from "@/components/ui/use-toast";

const Play = () => {
  const { id: gameId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showCode, setShowCode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const [hasRefreshedAfterGeneration, setHasRefreshedAfterGeneration] = useState(false);

  // Get search params
  const generating = searchParams.get("generating") === "true";
  const initialType = searchParams.get("type") || "webdesign";
  const initialModelType = searchParams.get("modelType") || "smart";
  const initialImageUrl = searchParams.get("imageUrl") || "";

  // Use custom hooks
  const { 
    game, 
    currentVersion, 
    gameVersions, 
    fetchGame,
    isLoading: gameDataLoading 
  } = usePlayGameData(gameId);
  
  const { handleGameUpdate, revertToMessageVersion } = useGameUpdate(
    gameId, game, gameVersions, fetchGame
  );
  
  // Set the initial prompt for terminal
  const initialPrompt = game?.prompt || "Loading...";
  
  const {
    generationInProgress,
    terminalOutput,
    showTerminal,
    thinkingTime,
    handleTerminalStatusChange,
    setShowTerminal,
    generationError
  } = usePlayTerminal(gameId, generating, initialPrompt, initialType, initialModelType, initialImageUrl);

  // When generation completes, refresh the game data to get the latest version
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;
    
    if (!generationInProgress && gameId && generating && !hasRefreshedAfterGeneration) {
      console.log("Generation completed, refreshing game data");
      
      // Use multiple attempts to ensure we get the latest data
      const refreshData = async () => {
        console.log("Attempting to refresh game data");
        setHasRefreshedAfterGeneration(true);
        
        try {
          // Make multiple attempts to fetch the updated data
          for (let i = 0; i < 3; i++) {
            await fetchGame();
            console.log(`Game data refresh attempt ${i+1} completed`);
            
            // Check if we have valid code
            if (currentVersion?.code && 
                currentVersion.code !== "Generating..." && 
                currentVersion.code.length > 100) {
              console.log("Valid game code found after refresh");
              
              // Remove the generating parameter from URL after successful generation
              if (generating) {
                navigate(`/play/${gameId}`, { replace: true });
              }
              
              break;
            }
            
            if (i < 2) {
              // Wait before trying again
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
        } catch (error) {
          console.error("Error refreshing game data:", error);
          toast({
            title: "Error loading content",
            description: "Failed to load the generated content. Please try refreshing the page.",
            variant: "destructive"
          });
        }
      };
      
      // Add a slight delay to ensure database is updated
      refreshTimer = setTimeout(refreshData, 1000);
    }
    
    if (generationError) {
      console.error("Generation error detected:", generationError);
      toast({
        title: "Generation Error",
        description: generationError || "Failed to generate content. Please try again.",
        variant: "destructive"
      });
    }
    
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [
    generationInProgress, 
    gameId, 
    generating, 
    fetchGame, 
    hasRefreshedAfterGeneration, 
    currentVersion, 
    toast,
    generationError,
    navigate
  ]);

  // Log when currentVersion changes
  useEffect(() => {
    if (currentVersion) {
      console.log("Current version updated:", currentVersion.id, "Code length:", currentVersion.code?.length);
    }
  }, [currentVersion]);

  // Reset the refresh state if gameId changes
  useEffect(() => {
    setHasRefreshedAfterGeneration(false);
  }, [gameId]);

  // Manually attempt to refresh game data if no code is loaded after a timeout
  useEffect(() => {
    let checkTimer: NodeJS.Timeout;
    
    if (!generating && gameId && !gameDataLoading && currentVersion?.code === "Generating...") {
      console.log("Content still shows 'Generating...', scheduling additional refresh");
      
      checkTimer = setTimeout(async () => {
        console.log("Executing additional refresh for game data");
        await fetchGame();
      }, 3000);
    }
    
    return () => {
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, [gameId, generating, gameDataLoading, currentVersion, fetchGame]);

  if (!gameId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>No game ID provided</p>
      </div>
    );
  }

  if (gameDataLoading && !generationInProgress) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-3"></div>
        <p>Loading game data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <PlayNavbar
        gameId={gameId}
        gameName={game?.prompt || "Loading..."}
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

      <div className="flex flex-grow w-full overflow-hidden">
        <SidebarChat
          gameId={gameId}
          generationInProgress={generationInProgress}
          onGameUpdate={handleGameUpdate}
          onTerminalStatusChange={handleTerminalStatusChange}
          onRevertToMessageVersion={revertToMessageVersion}
          gameVersions={gameVersions}
          initialPrompt={initialPrompt}
        />
        
        <div className="flex-1 h-full overflow-hidden">
          {generationInProgress ? (
            <GenerationTerminal
              open={showTerminal}
              onOpenChange={setShowTerminal}
              output={terminalOutput}
              thinkingTime={thinkingTime}
              loading={generationInProgress}
              asModal={false}
            />
          ) : (
            <GamePreview
              currentVersion={currentVersion}
              showCode={showCode}
              ref={iframeRef}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Play;
