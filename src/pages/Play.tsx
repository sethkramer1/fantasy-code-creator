
import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTerminal } from "@/components/game-player/hooks/useTerminal";
import { useGameVersions } from "@/components/game-player/hooks/useGameVersions";
import { useInitialGeneration } from "@/components/game-player/hooks/useInitialGeneration";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { GameActions } from "@/components/game-player/GameActions";
import { PlayContent } from "@/components/game-player/PlayContent";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { Message } from "@/components/game-chat/types";
import { toast } from "@/hooks/use-toast";

const Play = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isGenerating = searchParams.get('generating') === 'true';
  const gameType = searchParams.get('type') || '';
  const encodedImageUrl = searchParams.get('imageUrl') || '';
  const imageUrl = encodedImageUrl ? decodeURIComponent(encodedImageUrl) : '';
  
  const [showCode, setShowCode] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const terminal = useTerminal(isGenerating);
  const gameVersions = useGameVersions(id);
  const initialGeneration = useInitialGeneration();

  useEffect(() => {
    if (isGenerating && id && !initialGeneration.generationStartedRef.current) {
      initialGeneration.generationStartedRef.current = true;
      initialGeneration.handleInitialGeneration(
        id, 
        terminal.updateTerminalOutput, 
        terminal.setThinkingTime, 
        terminal.setGenerationInProgress, 
        imageUrl, 
        gameType, 
        gameVersions.fetchGame
      );
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

  useEffect(() => {
    gameVersions.fetchGame();
  }, [id]);

  useEffect(() => {
    if (!gameVersions.loading && iframeRef.current) {
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
  }, [gameVersions.loading, gameVersions.selectedVersion]);

  const handleCodeUpdate = async (gameId: string, newCode: string) => {
    try {
      // We're using the existing updateGame function from the gameVersions hook
      // but we create a simplified version of a message to trigger the update
      const updateMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        created_at: new Date().toISOString(),
        content: "Updated font styling in the HTML",
        game_id: id!,
        // Include the minimum required fields
        metadata: {
          code: newCode,
          thinking: "",
          files_changed: ["Font styling updated"]
        }
      };
      
      await gameVersions.handleGameUpdate(updateMessage);
      console.log("Code with new font styling saved successfully");
    } catch (error) {
      console.error("Failed to update code with new font:", error);
      toast({
        title: "Update Failed",
        description: "Failed to save the font changes. Please try again.",
        variant: "destructive"
      });
    }
  };

  const currentVersion = gameVersions.gameVersions.find(v => v.id === gameVersions.selectedVersion);
  const isLatestVersion = currentVersion?.version_number === gameVersions.gameVersions[0]?.version_number;

  if (gameVersions.loading && !terminal.showGenerating) {
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
          showGenerating={terminal.showGenerating}
          isLatestVersion={isLatestVersion}
          onRevertToVersion={gameVersions.handleRevertToVersion}
        />
      </PlayNavbar>
      
      <div className="flex flex-1 overflow-hidden">
        <SidebarChat 
          gameId={id!}
          generationInProgress={terminal.generationInProgress}
          onGameUpdate={gameVersions.handleGameUpdate}
          onTerminalStatusChange={terminal.handleTerminalStatusChange}
          onRevertToMessageVersion={gameVersions.handleRevertToMessageVersion}
          gameVersions={gameVersions.gameVersions}
          initialPrompt={gameVersions.initialPrompt || initialGeneration.initialPrompt}
        />

        <PlayContent 
          showGenerating={terminal.showGenerating}
          gameVersions={gameVersions.gameVersions}
          selectedVersion={gameVersions.selectedVersion}
          onVersionChange={gameVersions.handleVersionChange}
          onRevertToVersion={gameVersions.handleRevertToVersion}
          showCode={showCode}
          setShowCode={setShowCode}
          terminalOutput={terminal.terminalOutput}
          thinkingTime={terminal.thinkingTime}
          generationInProgress={terminal.generationInProgress}
          isLatestVersion={isLatestVersion}
          currentVersion={currentVersion}
          onCodeUpdate={handleCodeUpdate}
        />
      </div>
    </div>
  );
};

export default Play;
