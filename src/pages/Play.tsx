
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { PlayContent } from "@/components/game-player/PlayContent";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { useToast } from "@/hooks/use-toast";
import { useGameVersions } from "@/components/game-player/hooks/useGameVersions";
import { useTerminal } from "@/components/game-player/hooks/useTerminal";

export default function Play() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<string>("smart");
  const [chatInput, setChatInput] = useState("");

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

  // Find the current version based on selectedVersion
  const currentVersion = gameVersions.find(version => version.id === selectedVersion);
  
  // Check if current version is the latest
  const isLatestVersion = gameVersions.length > 0 ? 
    selectedVersion === gameVersions[0].id : 
    true;

  // Use terminal hook
  const terminal = useTerminal(false);
  
  // Create a chat submit handler
  const handleChatSubmit = (message: string, image?: File | null) => {
    // You would implement chat submission logic here
    console.log("Chat message submitted:", message, image);
  };

  const handleModelChange = (value: string) => {
    setModelType(value);
  };

  useEffect(() => {
    if (gameVersions.length > 0 && sidebarOpen === false) {
      toast({
        title: "Chat is available",
        description: "Click the chat icon to ask questions or request changes",
      });
    }
  }, [gameVersions, sidebarOpen, toast]);

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
          showSidebar={sidebarOpen}
          setShowSidebar={setSidebarOpen}
          isOpen={sidebarOpen} 
          setIsOpen={setSidebarOpen}
          onSubmit={handleChatSubmit}
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
