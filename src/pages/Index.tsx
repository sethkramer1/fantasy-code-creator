
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { GameTypeSelector } from "@/components/game-creator/GameTypeSelector";
import { GamePromptInput } from "@/components/game-creator/GamePromptInput";
import { GamesList } from "@/components/game-creator/GamesList";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { Game, gameTypes } from "@/types/game";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [gameType, setGameType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();
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
          variant: "destructive"
        });
      } finally {
        setGamesLoading(false);
      }
    };

    fetchGames();
  }, [toast]);

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
  }, [loading]);

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
    setTerminalOutput([`> Starting generation with prompt: "${prompt}"`]);
    
    let gameContent = '';
    let currentThinking = '';

    try {
      const selectedType = gameTypes.find(type => type.id === gameType);
      const enhancedPrompt = selectedType 
        ? `Create a ${selectedType.label} with ${selectedType.example}. Specific requirements: ${prompt}`
        : prompt;

      const response = await fetch(
        'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo',
          },
          body: JSON.stringify({ prompt: enhancedPrompt }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
                setTerminalOutput(prev => [...prev, "> AI is analyzing your request..."]);
                break;

              case 'content_block_start':
                if (data.content_block?.type === 'thinking') {
                  setTerminalOutput(prev => [...prev, "\n> Thinking phase started..."]);
                  currentThinking = '';
                }
                break;

              case 'content_block_delta':
                if (data.delta?.type === 'thinking_delta') {
                  const thinking = data.delta.thinking || '';
                  if (thinking && thinking !== currentThinking) {
                    currentThinking = thinking;
                    setTerminalOutput(prev => [...prev, `> ${thinking}`]);
                  }
                } else if (data.delta?.type === 'text_delta') {
                  const content = data.delta.text || '';
                  if (content) {
                    gameContent += content;
                    setTerminalOutput(prev => [...prev, `> Generated ${content.length} characters of game code`]);
                  }
                }
                break;

              case 'content_block_stop':
                if (currentThinking) {
                  setTerminalOutput(prev => [...prev, "> Thinking phase completed"]);
                  currentThinking = '';
                }
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
            setTerminalOutput(prev => [...prev, `> Error: ${e instanceof Error ? e.message : 'Unknown error'}`]);
          }
        }
      }

      if (!gameContent) {
        throw new Error("No game content received");
      }

      setTerminalOutput(prev => [...prev, "> Saving game to database..."]);

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert([{ 
          prompt: prompt,
          code: gameContent,
          instructions: "Game generated successfully",
          current_version: 1
        }])
        .select()
        .single();

      if (gameError) throw gameError;
      if (!gameData) throw new Error("Failed to save game");

      const { error: versionError } = await supabase
        .from('game_versions')
        .insert([{
          game_id: gameData.id,
          code: gameContent,
          instructions: "Game generated successfully",
          version_number: 1
        }]);

      if (versionError) throw versionError;
      
      setTerminalOutput(prev => [...prev, "> Game and initial version saved successfully! Redirecting..."]);
      
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
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-light tracking-tight text-black">Game Creator</h1>
            <p className="text-base md:text-lg text-[#757575]">
              Describe your game idea and watch it come to life
            </p>
          </div>

          <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
            <div className="space-y-6">
              <GameTypeSelector 
                selectedType={gameType}
                onSelect={setGameType}
              />
              <GamePromptInput 
                value={prompt}
                onChange={setPrompt}
              />
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={generateGame}
                disabled={loading}
                className="flex-1 py-3 px-6 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Generating your game...</span>
                  </>
                ) : (
                  <span>Generate Game</span>
                )}
              </button>
              {!showTerminal && terminalOutput.length > 0 && (
                <button
                  onClick={() => setShowTerminal(true)}
                  className="p-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                  title="Show generation progress"
                >
                  <Terminal size={18} className="text-gray-600" />
                </button>
              )}
            </div>
          </div>

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
