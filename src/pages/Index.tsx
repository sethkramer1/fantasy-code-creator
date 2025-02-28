
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/game-creator/Header";
import { GenerationForm } from "@/components/game-creator/GenerationForm";
import { GamesList } from "@/components/game-creator/GamesList";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { useGameGeneration } from "@/hooks/useGameGeneration";
import { useGames } from "@/hooks/useGames";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [gameType, setGameType] = useState<string>("webdesign");
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
      if (!prompt.trim()) {
        toast({
          title: "Please enter a description",
          variant: "destructive",
        });
        return;
      }

      if (!gameType) {
        toast({
          title: "Please select a content type",
          description: "Choose what you want to create before proceeding",
          variant: "destructive",
        });
        return;
      }

      // Create a placeholder game record
      const { data: placeholderGame, error: placeholderError } = await supabase
        .from('games')
        .insert([{ 
          prompt: prompt,
          code: "Generating...",
          instructions: "Content is being generated...",
          current_version: 1,
          type: gameType
        }])
        .select()
        .single();

      if (placeholderError) {
        console.error("Error creating placeholder game:", placeholderError);
        toast({
          title: "Error starting generation",
          description: placeholderError.message,
          variant: "destructive",
        });
        return;
      }

      // Create a placeholder version
      const { error: versionError } = await supabase
        .from('game_versions')
        .insert([{
          game_id: placeholderGame.id,
          code: "Generating...",
          instructions: "Content is being generated...",
          version_number: 1
        }]);

      if (versionError) {
        console.error("Error creating placeholder version:", versionError);
      }

      console.log("Navigating to play page for generation:", placeholderGame.id);
      
      // Navigate immediately to the play page with a generating flag
      navigate(`/play/${placeholderGame.id}?generating=true`);
      
      // Start the actual generation in the background
      const imageUrlToUse = imageUrl && imageUrl.startsWith('data:') ? imageUrl : undefined;
      
      // This will now run after navigation
      generateGame(prompt, gameType, imageUrlToUse, placeholderGame.id).then(gameData => {
        if (gameData) {
          console.log("Generation completed successfully:", gameData.id);
          toast({
            title: "Generated successfully!",
            description: "Your content is ready to view.",
          });
        }
      }).catch(error => {
        console.error("Error generating game:", error);
        toast({
          title: "Generation failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
        });
      });
    } catch (error) {
      console.error("Error in handleGenerate:", error);
      toast({
        title: "Error starting generation",
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
            title="What would you like to mock up?"
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
