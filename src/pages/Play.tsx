
import { useRef, useState, useEffect, useCallback } from "react";
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
  
  // State for handling generation completion
  const [hasRefreshedAfterGeneration, setHasRefreshedAfterGeneration] = useState(false);
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const maxRefreshAttempts = 5;
  const dataRefreshRef = useRef<boolean>(false);

  // Get search params for generation
  const generating = searchParams.get("generating") === "true";
  const initialType = searchParams.get("type") || "webdesign";
  const initialModelType = searchParams.get("modelType") || "smart";
  const initialImageUrl = searchParams.get("imageUrl") || "";
  
  // Get the prompt directly from URL params first
  const promptFromUrl = searchParams.get("prompt") || "";
  
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
  
  // Set the initial prompt prioritizing URL param over database value
  // This ensures we use the fresh user input rather than any placeholder
  const initialPrompt = promptFromUrl || (game?.prompt || "Loading...");
  
  // Log the selected prompt source for debugging
  useEffect(() => {
    if (promptFromUrl) {
      console.log("Using prompt from URL:", promptFromUrl);
    } else if (game?.prompt) {
      console.log("Using prompt from database:", game.prompt);
    }
  }, [promptFromUrl, game]);
  
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
      
      // Only schedule refresh if we haven't already done so
      if (!dataRefreshRef.current) {
        dataRefreshRef.current = true;
        
        // Define the refresh data function with retry logic
        const refreshData = async () => {
          console.log(`Attempting to refresh game data (attempt ${refreshAttempts + 1}/${maxRefreshAttempts})`);
          
          try {
            await fetchGame();
            console.log(`Game data refresh attempt ${refreshAttempts + 1} completed`);
            setRefreshAttempts(prev => prev + 1);
            
            // Check if we have valid code
            if (currentVersion?.code && 
                currentVersion.code !== "Generating..." && 
                currentVersion.code.length > 100) {
              console.log("Valid game code found after refresh");
              
              // Remove the generating parameter from URL after successful generation
              if (generating) {
                navigate(`/play/${gameId}`, { replace: true });
                setHasRefreshedAfterGeneration(true);
              }
              
              // Success, exit the refresh cycle
              dataRefreshRef.current = false;
              return;
            }
            
            // If we've made too many attempts, give up
            if (refreshAttempts >= maxRefreshAttempts) {
              console.log("Maximum refresh attempts reached, giving up");
              setHasRefreshedAfterGeneration(true);
              dataRefreshRef.current = false;
              
              toast({
                title: "Generation completed",
                description: "However, we couldn't load the latest content. Try refreshing the page.",
                variant: "destructive"
              });
              
              // Remove the generating parameter even if we failed
              if (generating) {
                navigate(`/play/${gameId}`, { replace: true });
              }
              
              return;
            }
            
            // Schedule another attempt with increasing delay
            const delay = Math.min(1000 * (refreshAttempts + 1), 5000);
            refreshTimer = setTimeout(refreshData, delay);
          } catch (error) {
            console.error("Error refreshing game data:", error);
            
            // If we've made too many attempts, give up and show an error
            if (refreshAttempts >= maxRefreshAttempts - 1) {
              toast({
                title: "Error loading content",
                description: "Failed to load the generated content. Please try refreshing the page.",
                variant: "destructive"
              });
              
              setHasRefreshedAfterGeneration(true);
              dataRefreshRef.current = false;
              
              // Remove the generating parameter even if we failed
              if (generating) {
                navigate(`/play/${gameId}`, { replace: true });
              }
              
              return;
            }
            
            // Retry with a delay
            setRefreshAttempts(prev => prev + 1);
            refreshTimer = setTimeout(refreshData, 2000);
          }
        };
        
        // Add a slight delay to ensure database is updated
        refreshTimer = setTimeout(refreshData, 1000);
      }
    }
    
    // Handle generation error
    if (generationError) {
      console.error("Generation error detected:", generationError);
      toast({
        title: "Generation Error",
        description: generationError || "Failed to generate content. Please try again.",
        variant: "destructive"
      });
      
      // Remove the generating parameter if there was an error
      if (generating) {
        navigate(`/play/${gameId}`, { replace: true });
      }
      
      setHasRefreshedAfterGeneration(true);
      dataRefreshRef.current = false;
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
    refreshAttempts, 
    currentVersion, 
    navigate, 
    toast,
    generationError,
    maxRefreshAttempts
  ]);

  // Log when currentVersion changes for debugging
  useEffect(() => {
    if (currentVersion) {
      console.log("Current version updated:", currentVersion.id, 
                  "Version number:", currentVersion.version_number,
                  "Code length:", currentVersion.code?.length);
    }
  }, [currentVersion]);

  // Reset the refresh state if gameId changes
  useEffect(() => {
    setHasRefreshedAfterGeneration(false);
    setRefreshAttempts(0);
    dataRefreshRef.current = false;
  }, [gameId]);

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
              key={currentVersion?.id || 'initial'}
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
