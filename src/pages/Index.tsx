
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface GameResponse {
  gameCode: string;
  instructions: string;
  error?: string;
}

interface Game {
  id: string;
  prompt: string;
  created_at: string;
}

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [generatedCode, setGeneratedCode] = useState("");
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('id, prompt, created_at')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setGames(data || []);
      } catch (error) {
        toast({
          title: "Error loading games",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive",
        });
      } finally {
        setGamesLoading(false);
      }
    };

    fetchGames();
  }, [toast]);

  const generateGame = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Please enter a game description",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setShowModal(true);
    setGeneratedCode("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-game`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(5));
              console.log('Received data:', data); // Debug log
              
              if (data.type === 'code') {
                setGeneratedCode(prev => prev + data.content);
              } else if (data.type === 'complete') {
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

                // Small delay before redirecting to ensure the user sees the success message
                await new Promise(resolve => setTimeout(resolve, 1000));
                setShowModal(false);
                navigate(`/play/${gameData.id}`);
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (parseError) {
              console.error('Error parsing stream data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Error generating game",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      setShowModal(false);
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

        <Dialog 
          open={showModal} 
          onOpenChange={(open) => {
            // Only allow closing if not loading
            if (!loading) {
              setShowModal(open);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <span>Generating Game</span>
                {loading && <Loader2 className="animate-spin" size={16} />}
              </DialogTitle>
            </DialogHeader>
            {/* Only show close button when not loading */}
            {!loading && (
              <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground" />
            )}
            <div className="font-mono text-sm bg-black text-green-400 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {generatedCode || 'Initializing...'}
            </div>
          </DialogContent>
        </Dialog>

        <div className="glass-panel rounded-xl p-6">
          <h2 className="text-2xl font-semibold mb-6">Available Games</h2>
          {gamesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : games.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => navigate(`/play/${game.id}`)}
                  className="p-4 rounded-lg bg-white bg-opacity-50 backdrop-blur-sm border border-gray-200 hover:border-gray-300 transition-all text-left group"
                >
                  <p className="font-medium group-hover:text-gray-900 transition-colors line-clamp-2">
                    {game.prompt}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {new Date(game.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              No games have been created yet. Be the first to create one!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
