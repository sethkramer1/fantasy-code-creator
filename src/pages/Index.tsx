
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface GameResponse {
  code: string;
  error?: string;
}

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [gameCode, setGameCode] = useState<string | null>(null);
  const { toast } = useToast();

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
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": "", // API key will be added later
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 1024,
          thinking: {
            type: "enabled",
            budget_tokens: 10000,
          },
          messages: [
            {
              role: "user",
              content: `Create a simple HTML5 game based on this description: ${prompt}. 
                       Return ONLY the complete HTML code that can be embedded in an iframe.
                       The game should work standalone without any external dependencies.`,
            },
          ],
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Extract code from Claude's response
      const gameCode = data.content[0].text;
      setGameCode(gameCode);
      
      toast({
        title: "Game generated successfully!",
        description: "You can now play your game below.",
      });
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

        {gameCode && (
          <div className="glass-panel rounded-xl p-6 space-y-4">
            <h2 className="text-2xl font-light">Your Game</h2>
            <div className="w-full aspect-video rounded-lg overflow-hidden border border-gray-200">
              <iframe
                srcDoc={gameCode}
                className="w-full h-full"
                sandbox="allow-scripts"
                title="Generated Game"
              />
            </div>
            <button
              onClick={() => setGameCode(null)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Generate a new game
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
