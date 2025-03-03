
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
  
  // State for handling generation completion
  const [hasRefreshedAfterGeneration, setHasRefreshedAfterGeneration] = useState(false);
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const maxRefreshAttempts = 5;
  const dataRefreshRef = useRef<boolean>(false);
  const stableVersionIdRef = useRef<string | null>(null);
  const stableGameRef = useRef<boolean>(false);
  
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

  // We use a stable reference for the current version ID
  useEffect(() => {
    if (currentVersion?.id && currentVersion.id !== stableVersionIdRef.current && 
        currentVersion.code && currentVersion.code !== "Generating..." &&
        currentVersion.code.length > 100) {
      console.log("Stable version detected, updating reference:", currentVersion.id);
      stableVersionIdRef.current = currentVersion.id;
      
      // Mark game as stable once we have good content
      if (!stableGameRef.current) {
        stableGameRef.current = true;
        
        // Stop any ongoing refresh attempts immediately
        if (dataRefreshRef.current) {
          console.log("Stopping refresh cycle - stable content detected");
          dataRefreshRef.current = false;
          setHasRefreshedAfterGeneration(true);
          
          // Remove the generating parameter from URL if needed
          if (generating) {
            navigate(`/play/${gameId}`, { replace: true });
          }
        }
      }
    }
  }, [currentVersion, generating, gameId, navigate]);

  // When generation completes, refresh the game data to get the latest version - BUT ONLY ONCE
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;
    
    // Only proceed if generation was in progress and has completed, we haven't refreshed yet
    // AND we don't already have stable content
    if (!generationInProgress && gameId && generating && !hasRefreshedAfterGeneration && !stableGameRef.current) {
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
              
              // Mark as stable to prevent further refresh cycles
              stableGameRef.current = true;
              
              // Use a delay to ensure stability before marking as complete
              setTimeout(() => {
                // Remove the generating parameter from URL after successful generation
                if (generating) {
                  navigate(`/play/${gameId}`, { replace: true });
                }
                
                setHasRefreshedAfterGeneration(true);
                
                // Mark data as stable to prevent further refresh cycles
                dataRefreshRef.current = false;
              }, 1000);
              
              return;
            }
            
            // If we've made too many attempts, give up
            if (refreshAttempts >= maxRefreshAttempts - 1) {
              console.log("Maximum refresh attempts reached, giving up");
              setHasRefreshedAfterGeneration(true);
              dataRefreshRef.current = false;
              stableGameRef.current = true;
              
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
            
            // Schedule another attempt with increasing delay IF we're not stable yet
            if (!stableGameRef.current) {
              const delay = Math.min(1000 * (refreshAttempts + 1), 5000);
              refreshTimer = setTimeout(refreshData, delay);
            }
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
              stableGameRef.current = true;
              
              // Remove the generating parameter even if we failed
              if (generating) {
                navigate(`/play/${gameId}`, { replace: true });
              }
              
              return;
            }
            
            // Only retry if not already stable
            if (!stableGameRef.current) {
              setRefreshAttempts(prev => prev + 1);
              refreshTimer = setTimeout(refreshData, 2000);
            }
          }
        };
        
        // Add a slight delay to ensure database is updated
        refreshTimer = setTimeout(refreshData, 1000);
      }
    }
    
    // Handle generation error - also stop refresh cycle
    if (generationError) {
      console.error("Generation error detected:", generationError);
      
      // Mark as stable to prevent refresh cycle
      stableGameRef.current = true;
      dataRefreshRef.current = false;
      
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

  // Reset the refresh state if gameId changes
  useEffect(() => {
    setHasRefreshedAfterGeneration(false);
    setRefreshAttempts(0);
    dataRefreshRef.current = false;
    stableVersionIdRef.current = null;
    stableGameRef.current = false;
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
              key={`preview-${stableVersionIdRef.current || 'loading'}`}
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
