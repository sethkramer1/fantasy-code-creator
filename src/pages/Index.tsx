
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface GameResponse {
  gameCode: string;
  instructions: string;
  error?: string;
}

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const generateGame = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Please enter a game description",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<GameResponse>("generate-game", {
        body: { prompt },
      });

      if (error) throw error;
      if (!data) throw new Error("No data received");
      
      // Save the game to the database
      const { data: gameData, error: insertError } = await supabase
        .from('games')
        .insert([
          { 
            prompt: prompt, 
            code: data.gameCode,
            instructions: data.instructions 
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      if (!gameData) throw new Error("Failed to save game");
      
      toast({
        title: "Game generated successfully!",
        description: "Redirecting to play the game...",
      });

      // Navigate to the play page
      navigate(`/play/${gameData.id}`);
    } catch (error) {
      toast({
        title: "Error generating game",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-light tracking-tight">Game Creator</h1>
          <p className="text-lg text-gray-600">
            Describe your game idea and watch it come to life
          </p>
        </div>

        <div className="glass-panel rounded-xl p-6 space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the game you want to create..."
            className="w-full h-32 p-4 rounded-lg bg-white bg-opacity-50 backdrop-blur-sm border border-gray-200 focus:ring-2 focus:ring-gray-200 focus:outline-none transition-all"
          />
          <button
            onClick={generateGame}
            disabled={loading}
            className="w-full py-3 px-6 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Generating your game...</span>
              </>
            ) : (
              <span>Generate Game</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
