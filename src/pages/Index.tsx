
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

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

    let gameContent = '';

    try {
      // Use direct fetch for SSE handling
      const response = await fetch(
        'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ prompt }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Create an event source from the response
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
            console.log('Received SSE data:', data);

            switch (data.type) {
              case 'message_start':
                setTerminalOutput(prev => [...prev, "> Starting game generation..."]);
                break;

              case 'content_block_start':
                if (data.content_block?.type === 'thinking') {
                  setTerminalOutput(prev => [...prev, "> Thinking about the game design..."]);
                }
                break;

              case 'content_block_delta':
                if (data.delta?.type === 'thinking_delta') {
                  setTerminalOutput(prev => [...prev, `> ${data.delta.thinking}`]);
                } else if (data.delta?.type === 'text_delta') {
                  const content = data.delta.text || '';
                  gameContent += content;
                  setTerminalOutput(prev => [...prev, `> Received ${content.length} characters of game code`]);
                }
                break;

              case 'content_block_stop':
                setTerminalOutput(prev => [...prev, "> Completed current content block"]);
                break;

              case 'message_delta':
                if (data.delta?.stop_reason) {
                  setTerminalOutput(prev => [...prev, `> Generation ${data.delta.stop_reason}`]);
                }
                break;

              case 'message_stop':
                setTerminalOutput(prev => [...prev, "> Game generation completed!"]);
                break;

              case 'error':
                throw new Error(data.error?.message || 'Unknown error in stream');
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e);
            continue;
          }
        }
      }

      if (!gameContent) {
        throw new Error("No game content received");
      }

      setTerminalOutput(prev => [...prev, "> Saving game to database..."]);

      const { data: gameData, error: insertError } = await supabase
        .from('games')
        .insert([{ 
          prompt: prompt,
          code: gameContent,
          instructions: "Game generated successfully" 
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      if (!gameData) throw new Error("Failed to save game");
      
      setTerminalOutput(prev => [...prev, "> Game saved successfully! Redirecting..."]);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Game generated successfully!",
        description: "Redirecting to play the game...",
      });

      setShowTerminal(false);
      navigate(`/play/${gameData.id}`);

    } catch (error) {
      console.error('Generation error:', error);
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
          <DialogTitle className="text-green-400">Game Generation Progress</DialogTitle>
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
