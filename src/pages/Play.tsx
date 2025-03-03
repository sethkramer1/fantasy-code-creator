
import { useRef, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { GamePreview } from "@/components/game-player/GamePreview";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { usePlayGameData } from "@/hooks/usePlayGameData";
import { useGameUpdate } from "@/hooks/useGameUpdate";
import { usePlayTerminal } from "@/hooks/usePlayTerminal";

const Play = () => {
  const { id: gameId } = useParams();
  const [searchParams] = useSearchParams();
  const [showCode, setShowCode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Get search params
  const generating = searchParams.get("generating") === "true";
  const initialType = searchParams.get("type") || "webdesign";
  const initialModelType = searchParams.get("modelType") || "smart";
  const initialImageUrl = searchParams.get("imageUrl") || "";

  // Use custom hooks
  const { game, currentVersion, gameVersions, fetchGame } = usePlayGameData(gameId);
  const { handleGameUpdate, revertToMessageVersion } = useGameUpdate(gameId, game, gameVersions, fetchGame);
  
  // Set the initial prompt for terminal
  const initialPrompt = game?.prompt || "Loading...";
  
  const {
    generationInProgress,
    terminalOutput,
    showTerminal,
    thinkingTime,
    handleTerminalStatusChange,
    setShowTerminal
  } = usePlayTerminal(gameId, generating, initialPrompt, initialType, initialModelType, initialImageUrl);

  // When generation completes, refresh the game data to get the latest version
  useEffect(() => {
    if (!generationInProgress && gameId && generating) {
      console.log("Generation completed, refreshing game data");
      fetchGame();
    }
  }, [generationInProgress, gameId, generating, fetchGame]);

  if (!gameId || !game) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full">
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
