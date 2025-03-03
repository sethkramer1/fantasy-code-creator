
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { PlayContent } from "@/components/game-player/PlayContent";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { useToast } from "@/hooks/use-toast";
import { useGameVersions } from "@/components/game-player/hooks/useGameVersions";
import { useInitialGeneration } from "@/components/game-player/hooks/useInitialGeneration";
import { useTerminal } from "@/components/game-player/hooks/useTerminal";

export default function Play() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [input, setInput] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<string>("smart");

  // Validate that we have a gameId
  if (!gameId) {
    useEffect(() => {
      navigate("/");
    }, [navigate]);
    return null;
  }

  // Game versions hook
  const gameVersionsState = useGameVersions(gameId);
  const { 
    gameVersions,
    loadingVersions,
    currentVersion,
    selectedVersionId,
    setSelectedVersionId,
    isLatestVersion,
    handleRevertToVersion
  } = gameVersionsState;

  const { input: chatInput, setInput: setChatInput, messages, loading, handleSubmit } = useTerminal(gameId, selectedVersionId);

  // Initial game generation hook for new games
  useInitialGeneration(gameId);

  const handleModelChange = (value: string) => {
    setModelType(value);
  };

  useEffect(() => {
    if (messages.length > 0 && sidebarOpen === false) {
      toast({
        title: "Chat is available",
        description: "Click the chat icon to ask questions or request changes",
      });
    }
  }, [messages, sidebarOpen, toast]);

  // Mobile sidebar handler
  useEffect(() => {
    // Close sidebar when resizing to desktop if it was opened on mobile
    const handleResize = () => {
      if (window.innerWidth >= 1024 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

  // Show loading state while fetching game versions
  if (loadingVersions) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
          <p className="text-sm text-gray-500">Loading game...</p>
        </div>
      </div>
    );
  }

  // If no versions found after loading is complete
  if (!loadingVersions && gameVersions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <h1 className="mb-4 text-xl font-bold dark:text-white">Game not found</h1>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            The game you're looking for doesn't exist or is still being generated. Please check back later.
          </p>
          <button
            onClick={() => navigate("/")}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <PlayNavbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        showCode={showCode}
        setShowCode={setShowCode}
        isLatestVersion={isLatestVersion}
        onRevertToVersion={handleRevertToVersion}
        currentVersion={currentVersion}
        gameId={gameId}
      />
      <div className="relative flex flex-1 overflow-hidden">
        <PlayContent
          gameVersions={gameVersions}
          selectedVersionId={selectedVersionId}
          setSelectedVersionId={setSelectedVersionId}
          showCode={showCode}
          gameId={gameId}
        />
        
        {/* Sidebar */}
        <SidebarChat
          open={sidebarOpen}
          setOpen={setSidebarOpen} 
          onSubmit={handleSubmit}
          input={chatInput}
          setInput={setChatInput}
          loading={loading}
          disabled={!isLatestVersion}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          modelType={modelType}
          handleModelChange={handleModelChange}
        />
      </div>
    </div>
  );
}
