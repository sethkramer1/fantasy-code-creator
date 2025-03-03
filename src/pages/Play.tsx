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
import { ViewToggle } from "@/components/game-player/ViewToggle";
import { VersionHistory } from "@/components/game-player/components/VersionHistory";

const Play = () => {
  const { id: gameId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showCode, setShowCode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const contentInitializedRef = useRef(false);
  
  const generating = searchParams.get("generating") === "true";
  const initialType = searchParams.get("type") || "webdesign";
  const initialModelType = searchParams.get("modelType") || "smart";
  const initialImageUrl = searchParams.get("imageUrl") || "";
  const promptFromUrl = searchParams.get("prompt") || "";
  
  const generationHandledRef = useRef(false);
  
  const { 
    game, 
    currentVersion, 
    gameVersions, 
    fetchGame,
    isLoading: gameDataLoading 
  } = usePlayGameData(gameId);
  
  const { 
    handleGameUpdate, 
    revertToMessageVersion, 
    revertToVersion 
  } = useGameUpdate(
    gameId, game, gameVersions, fetchGame
  );
  
  const initialPrompt = promptFromUrl || (game?.prompt || "Loading...");
  
  const {
    generationInProgress,
    terminalOutput,
    showTerminal,
    thinkingTime,
    handleTerminalStatusChange,
    setShowTerminal,
    generationError
  } = usePlayTerminal(gameId, generating, initialPrompt, initialType, initialModelType, initialImageUrl);

  const hasValidContent = useCallback(() => {
    return currentVersion?.code && 
           currentVersion.code !== "Generating..." && 
           currentVersion.code.length > 100;
  }, [currentVersion]);

  useEffect(() => {
    generationHandledRef.current = false;
    contentInitializedRef.current = false;
  }, [gameId]);

  useEffect(() => {
    if (generating && !generationInProgress && !generationHandledRef.current) {
      generationHandledRef.current = true;
      
      const loadContent = async () => {
        try {
          await fetchGame();
          navigate(`/play/${gameId}`, { replace: true });
        } catch (error) {
          console.error("Error refreshing game data after generation:", error);
          toast({
            title: "Error loading content",
            description: "Failed to load the generated content. Please try refreshing the page.",
            variant: "destructive"
          });
          navigate(`/play/${gameId}`, { replace: true });
        }
      };
      
      loadContent();
    }
    
    if (generationError && !generationHandledRef.current) {
      generationHandledRef.current = true;
      
      if (generating) {
        navigate(`/play/${gameId}`, { replace: true });
      }
      
      toast({
        title: "Generation Error",
        description: generationError || "Failed to generate content. Please try again.",
        variant: "destructive"
      });
    }
  }, [generationInProgress, gameId, fetchGame, navigate, toast, generating, generationError]);

  useEffect(() => {
    if (hasValidContent() && !contentInitializedRef.current) {
      contentInitializedRef.current = true;
      console.log("Content initialized successfully");
    }
  }, [hasValidContent]);

  if (!gameId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>No game ID provided</p>
      </div>
    );
  }

  if (gameDataLoading && !generationInProgress && !contentInitializedRef.current) {
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
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center p-3 bg-zinc-900 border-b border-zinc-800">
                <ViewToggle showCode={showCode} onToggle={setShowCode} />
                <VersionHistory 
                  gameVersions={gameVersions} 
                  currentVersionId={currentVersion?.id}
                  onRevertToVersion={revertToVersion} 
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <GamePreview
                  key={`preview-${currentVersion?.id || 'loading'}`}
                  currentVersion={currentVersion}
                  showCode={showCode}
                  ref={iframeRef}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Play;
