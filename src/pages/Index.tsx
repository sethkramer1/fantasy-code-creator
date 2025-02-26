
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
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
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
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
    setShowTerminal(true);
    setTerminalOutput([`> Generating game based on prompt: "${prompt}"`]);

    try {
      const response = await fetch("https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabase.auth.session()?.access_token}`,
        },
        body: JSON.stringify({ prompt, stream: true }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            if (!line.startsWith('data: ')) continue;
            const data = JSON.parse(line.slice(5));

            if (data.type === 'content_block_delta' && data.delta.thinking) {
              setTerminalOutput(prev => [...prev, `> ${data.delta.thinking}`]);
            } else if (data.type === 'message_delta' && data.delta.content) {
              setTerminalOutput(prev => [...prev, `> Generated content: ${data.delta.content.length} characters`]);
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e);
          }
        }
      }

      const { data, error } = await supabase
        .from('games')
        .insert([{ 
          prompt: prompt,
          code: response.ok ? await response.text() : "",
          instructions: "Game generated successfully" 
        }])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("Failed to save game");
      
      toast({
        title: "Game generated successfully!",
        description: "Redirecting to play the game...",
      });

      setTimeout(() => {
        setShowTerminal(false);
        navigate(`/play/${data.id}`);
      }, 1000);

    } catch (error) {
      toast({
        title: "Error generating game",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : "Generation failed"}`]);
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

      <Dialog open={showTerminal} onOpenChange={setShowTerminal}>
        <DialogContent className="bg-black text-green-400 font-mono p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            {terminalOutput.map((line, index) => (
              <div key={index} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
            {loading && (
              <div className="animate-pulse">_</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
