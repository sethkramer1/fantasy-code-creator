
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { PlayContent } from "@/components/game-player/PlayContent";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { LoadingState } from "@/components/game-player/LoadingState";
import { ErrorState } from "@/components/game-player/ErrorState";
import { useGameVersions } from "@/components/game-player/hooks/useGameVersions";
import { useTerminal } from "@/components/game-player/hooks/useTerminal";
import { usePlayUI } from "@/components/game-player/hooks/usePlayUI";
import { useChatHandler } from "@/components/game-player/hooks/useChatHandler";

export default function Play() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  // Validate that we have a gameId
  if (!gameId) {
    useEffect(() => {
      navigate("/");
    }, [navigate]);
    return null;
  }

  // Game versions hook
  const {
    gameVersions,
    loading: loadingVersions,
    selectedVersion,
    setSelectedVersion,
    initialPrompt,
    handleRevertToVersion,
    handleGameUpdate,
    handleRevertToMessageVersion
  } = useGameVersions(gameId);

  // UI state management
  const {
    sidebarOpen,
    setSidebarOpen,
    showCode,
    setShowCode,
    imageUrl,
    setImageUrl,
    modelType,
    handleModelChange,
    chatInput,
    setChatInput
  } = usePlayUI(gameVersions.length);

  // Chat handler
  const { chatLoading, handleChatSubmit } = useChatHandler();

  // Use terminal hook
  const terminal = useTerminal(false);
  
  // Find the current version based on selectedVersion
  const currentVersion = gameVersions.find(version => version.id === selectedVersion);
  
  // Check if current version is the latest
  const isLatestVersion = gameVersions.length > 0 ? 
    selectedVersion === gameVersions[0].id : 
    true;

  // Show loading state while fetching game versions
  if (loadingVersions) {
    return <LoadingState />;
  }

  // If no versions found after loading is complete
  if (!loadingVersions && gameVersions.length === 0) {
    return <ErrorState />;
  }

  return (
    <div className="flex h-screen flex-col">
      <PlayNavbar
        gameId={gameId}
        showSidebar={sidebarOpen}
        setShowSidebar={setSidebarOpen}
      />
      <div className="relative flex flex-1 overflow-hidden">
        <PlayContent
          gameVersions={gameVersions}
          selectedVersion={selectedVersion}
          onVersionChange={setSelectedVersion}
          setSelectedVersion={setSelectedVersion}
          showCode={showCode}
          setShowCode={setShowCode}
          gameId={gameId}
          currentVersion={currentVersion}
          isLatestVersion={isLatestVersion}
          onRevertToVersion={handleRevertToVersion}
        />
        
        {/* Sidebar Chat */}
        <SidebarChat
          isOpen={sidebarOpen} 
          setIsOpen={setSidebarOpen}
          onSubmit={handleChatSubmit}
          input={chatInput}
          setInput={setChatInput}
          loading={chatLoading}
          disabled={!isLatestVersion}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          modelType={modelType}
          handleModelChange={handleModelChange}
          gameId={gameId}
          gameVersions={gameVersions}
          initialPrompt={initialPrompt}
          onGameUpdate={handleGameUpdate}
          onTerminalStatusChange={terminal.handleTerminalStatusChange}
          onRevertToMessageVersion={handleRevertToMessageVersion}
        />
      </div>
    </div>
  );
}
