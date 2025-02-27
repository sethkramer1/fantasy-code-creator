
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/game-creator/Header";
import { GenerationForm } from "@/components/game-creator/GenerationForm";
import { GamesList } from "@/components/game-creator/GamesList";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { useGameGeneration } from "@/hooks/useGameGeneration";
import { useGames } from "@/hooks/useGames";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [gameType, setGameType] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { games, gamesLoading } = useGames();
  const {
    loading,
    showTerminal,
    setShowTerminal,
    terminalOutput,
    thinkingTime,
    setThinkingTime,
    generateGame,
    timerRef
  } = useGameGeneration();

  useEffect(() => {
    if (loading) {
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
  }, [loading, timerRef, setThinkingTime]);

  const handleImageUploaded = (url: string) => {
    setImageUrl(url);
  };

  const handleImageRemoved = () => {
    setImageUrl("");
  };

  const handleGenerate = async () => {
    try {
      // Only pass imageUrl if it's a data URL (from FileReader)
      const imageUrlToUse = imageUrl && imageUrl.startsWith('data:') ? imageUrl : undefined;
      
      const gameData = await generateGame(prompt, gameType, imageUrlToUse);
      if (gameData) {
        toast({
          title: "Generated successfully!",
          description: "Redirecting to view the content...",
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        setShowTerminal(false);
        navigate(`/play/${gameData.id}`);
      }
    } catch (error) {
      console.error("Error generating game:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <div className="space-y-8">
          <Header 
            title="Creative Generator"
            description="Describe what you want to create and watch it come to life"
          />

          <GenerationForm
            gameType={gameType}
            setGameType={setGameType}
            prompt={prompt}
            setPrompt={setPrompt}
            onGenerate={handleGenerate}
            loading={loading}
            showTerminalOutput={() => setShowTerminal(true)}
            hasTerminalOutput={!showTerminal && terminalOutput.length > 0}
            imageUrl={imageUrl}
            onImageUploaded={handleImageUploaded}
            onImageRemoved={handleImageRemoved}
          />

          <GamesList
            games={games}
            isLoading={gamesLoading}
            onGameClick={(id) => navigate(`/play/${id}`)}
          />
        </div>
      </div>

      <GenerationTerminal
        open={showTerminal}
        onOpenChange={setShowTerminal}
        output={terminalOutput}
        thinkingTime={thinkingTime}
        loading={loading}
      />
    </div>
  );
};

export default Index;
