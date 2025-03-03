import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PlayNavbar } from "@/components/game-player/PlayNavbar";
import { SidebarChat } from "@/components/game-player/SidebarChat";
import { PlayContent } from "@/components/game-player/PlayContent";
import { useGameVersions } from "@/components/game-player/hooks/useGameVersions";
import { useGameChat } from "@/components/game-chat/useGameChat";
import { useToast } from "@/hooks/use-toast";

const Play = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [modelType, setModelType] = useState<string>("smart");
  const { toast } = useToast();

  const {
    gameVersions,
    selectedVersion,
    onVersionChange,
    onRevertToVersion,
    isLatestVersion,
    currentVersion,
    isLoading: versionsLoading,
  } = useGameVersions(gameId as string);

  const {
    messages,
    input,
    setInput,
    imageUrl,
    setImageUrl,
    handleSubmit,
    loading: chatLoading,
    disabled: chatDisabled,
    terminalOutput,
    thinkingTime,
    generationInProgress,
    setTerminalOutput,
    setThinkingTime,
    timerRef
  } = useGameChat(gameId as string, modelType);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const generatingParam = urlParams.get('generating');
    const typeParam = urlParams.get('type');
    const modelTypeParam = urlParams.get('modelType');
    const imageUrlParam = urlParams.get('imageUrl');

    if (generatingParam === 'true') {
      setGenerating(true);
    }

    if (typeParam) {
      // No longer setting gameType here
    }

    if (modelTypeParam) {
      setModelType(modelTypeParam);
    }

    if (imageUrlParam) {
      setImageUrl(decodeURIComponent(imageUrlParam));
    }
  }, [setImageUrl]);

  useEffect(() => {
    if (generationInProgress) {
      setThinkingTime(0);
      timerRef.current = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [generationInProgress, timerRef, setThinkingTime]);

  const handleModelChange = (value: string) => {
    setModelType(value);
  };

  if (!gameId) {
    return <div>Error: Game ID is required.</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <PlayNavbar 
        gameId={gameId}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        showCode={showCode}
        setShowCode={setShowCode}
        isLatestVersion={isLatestVersion}
        onRevertToVersion={onRevertToVersion}
        currentVersion={currentVersion}
      />
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <SidebarChat 
            messages={messages}
            input={input}
            setInput={setInput}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            handleSubmit={handleSubmit}
            loading={chatLoading}
            disabled={chatDisabled || generationInProgress}
            modelType={modelType}
            handleModelChange={handleModelChange}
          />
        )}
        <PlayContent
          showGenerating={generating}
          gameVersions={gameVersions}
          selectedVersion={selectedVersion}
          onVersionChange={onVersionChange}
          onRevertToVersion={onRevertToVersion}
          showCode={showCode}
          setShowCode={setShowCode}
          terminalOutput={terminalOutput}
          thinkingTime={thinkingTime}
          generationInProgress={generationInProgress}
          isLatestVersion={isLatestVersion}
          currentVersion={currentVersion}
          gameId={gameId} // Add this line to pass the gameId
        />
      </div>
    </div>
  );
};

export default Play;
