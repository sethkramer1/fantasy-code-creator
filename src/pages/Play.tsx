
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";

const Play = () => {
  const { id } = useParams();
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('code')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Game not found");

        setGameCode(data.code);
      } catch (error) {
        toast({
          title: "Error loading game",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center space-x-4">
          <Link
            to="/"
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Generator</span>
          </Link>
        </div>

        {gameCode && (
          <div className="glass-panel rounded-xl p-6">
            <div className="w-full aspect-video rounded-lg overflow-hidden border border-gray-200">
              <iframe
                srcDoc={gameCode}
                className="w-full h-full"
                sandbox="allow-scripts"
                title="Generated Game"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Play;
