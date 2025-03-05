
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
import { Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ModelType } from "@/types/generation";
import { AuthDebugger } from "@/components/debug/AuthDebugger";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [gameType, setGameType] = useState<string>("webdesign");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [visibility, setVisibility] = useState<string>("public");
  const modelType: ModelType = "smart";
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { games, gamesLoading, deleteGame } = useGames();
  const {
    loading,
    showTerminal,
    setShowTerminal,
    terminalOutput,
    thinkingTime,
    setThinkingTime,
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

      console.log("Generating with prompt:", prompt);
      console.log("Using model type:", modelType);

      const { data: placeholderGame, error: placeholderError } = await supabase
        .from('games')
        .insert([{ 
          prompt: prompt,
          code: "Generating...",
          instructions: "Content is being generated...",
          current_version: 1,
          type: gameType,
          model_type: modelType,
          user_id: user?.id || null,
          visibility: visibility
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
      
      const { error: messageError } = await supabase
        .from('game_messages')
        .insert([{
          game_id: placeholderGame.id,
          message: prompt,
          response: "Initial generation in progress...",
          model_type: modelType,
          image_url: imageUrl || null
        }]);
      
      if (messageError) {
        console.error("Error creating initial game_message:", messageError);
        // Non-fatal error, continue with generation
      } else {
        console.log("Created initial game_message for prompt");
      }
      
      let navigationParams = `?generating=true&type=${gameType}&modelType=${modelType}`;
      
      if (imageUrl) {
        const encodedImageUrl = encodeURIComponent(imageUrl);
        navigationParams += `&imageUrl=${encodedImageUrl}`;
      }
      
      navigationParams += `&prompt=${encodeURIComponent(prompt)}`;
      
      console.log("Navigating with prompt:", prompt);
      console.log("Encoded prompt in URL:", encodeURIComponent(prompt));
      
      navigate(`/play/${placeholderGame.id}${navigationParams}`);
      
      toast({
        title: "Starting generation",
        description: "Your content is being created...",
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
    <div className="min-h-screen bg-white">
      {import.meta.env.DEV && <AuthDebugger />}
      
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <div className="space-y-10">
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
            modelType={modelType}
            showModelPreference={false}
            visibility={visibility}
            setVisibility={setVisibility}
          />
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-gray-700" />
            <h2 className="text-xl font-medium text-black">
              {user ? "Designs Gallery" : "Community Designs"}
            </h2>
          </div>
        </div>

        <GamesList
          games={games}
          isLoading={gamesLoading}
          onGameClick={(id) => navigate(`/play/${id}`)}
          onGameDelete={deleteGame}
        />
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
