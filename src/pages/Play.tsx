
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
  
  // Get search params for generation
  const generating = searchParams.get("generating") === "true";
  const initialType = searchParams.get("type") || "webdesign";
  const initialModelType = searchParams.get("modelType") || "smart";
  const initialImageUrl = searchParams.get("imageUrl") || "";
  const promptFromUrl = searchParams.get("prompt") || "";
  
  // Single flag to track if we need to handle post-generation actions
  const [postGenerationHandled, setPostGenerationHandled] = useState(false);
  
  // Use custom hooks for data fetching and game updates
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
  
  // Set the initial prompt prioritizing URL param over database value
  const initialPrompt = promptFromUrl || (game?.prompt || "Loading...");
  
  // Terminal state management
  const {
    generationInProgress,
    terminalOutput,
    showTerminal,
    thinkingTime,
    handleTerminalStatusChange,
    setShowTerminal,
    generationError
  } = usePlayTerminal(gameId, generating, initialPrompt, initialType, initialModelType, initialImageUrl);

  // Function to check if we have valid content
  const hasValidContent = () => {
    return currentVersion?.code && 
           currentVersion.code !== "Generating..." && 
           currentVersion.code.length > 100;
  };

  // Reset post-generation handling flag when gameId changes
  useEffect(() => {
    setPostGenerationHandled(false);
  }, [gameId]);

  // Handle post-generation actions only once
  useEffect(() => {
    // Only proceed if we're in generating mode and generation has completed
    if (generating && !generationInProgress && !postGenerationHandled) {
      // Set a one-time refresh attempt
      const refreshTimer = setTimeout(async () => {
        try {
          await fetchGame();
          
          // Check if we received valid content
          if (hasValidContent()) {
            // Remove generating param from URL
            navigate(`/play/${gameId}`, { replace: true });
            setPostGenerationHandled(true);
          } else {
            // If we didn't get valid content yet, try once more after a delay
            const secondAttemptTimer = setTimeout(async () => {
              await fetchGame();
              
              // Regardless of outcome, mark as handled to prevent infinite loop
              setPostGenerationHandled(true);
              
              // Remove generating param from URL
              navigate(`/play/${gameId}`, { replace: true });
            }, 2000);
            
            return () => clearTimeout(secondAttemptTimer);
          }
        } catch (error) {
          console.error("Error refreshing game data after generation:", error);
          
          // Mark as handled to prevent loops
          setPostGenerationHandled(true);
          
          // Remove generating param from URL
          navigate(`/play/${gameId}`, { replace: true });
          
          toast({
            title: "Error loading content",
            description: "Failed to load the generated content. Please try refreshing the page.",
            variant: "destructive"
          });
        }
      }, 1000); // Small initial delay
      
      return () => clearTimeout(refreshTimer);
    }
    
    // Handle generation error
    if (generationError && !postGenerationHandled) {
      setPostGenerationHandled(true);
      
      // Remove the generating parameter if there was an error
      if (generating) {
        navigate(`/play/${gameId}`, { replace: true });
      }
      
      toast({
        title: "Generation Error",
        description: generationError || "Failed to generate content. Please try again.",
        variant: "destructive"
      });
    }
  }, [
    generating, 
    generationInProgress, 
    gameId, 
    postGenerationHandled, 
    fetchGame, 
    hasValidContent, 
    navigate, 
    toast, 
    generationError
  ]);

  // Handle missing gameId
  if (!gameId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>No game ID provided</p>
      </div>
    );
  }

  // Show loading state
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
        gameName={initialPrompt !== "Loading..." ? initialPrompt : (game?.prompt || "Loading...")}
        showCodeEditor={showCode}
        onShowCodeEditorChange={setShowCode}
        onExport={() => {}}
        onDownload={() => {}}
        onFork={() => {}}
        onShare={() => {}}
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
              key={currentVersion?.id || 'loading'}
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
