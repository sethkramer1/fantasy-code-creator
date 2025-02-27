
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Game } from "@/types/game";
import html2canvas from "html2canvas";

export const useGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('id, prompt, created_at, code')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Generate previews for games with code
        const gamesWithPreviews = await Promise.all((data || []).map(async (game) => {
          if (!game.code) return game;
          
          try {
            // Create a temporary container to render the code
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.width = '800px'; // Set a fixed width for consistent previews
            container.style.height = '600px';
            container.innerHTML = game.code;
            document.body.appendChild(container);
            
            // Generate preview
            const canvas = await html2canvas(container, {
              width: 800,
              height: 600,
              scale: 0.25, // Scale down for thumbnail size
              logging: false,
              backgroundColor: '#ffffff'
            });
            
            // Convert to base64 and cleanup
            const preview = canvas.toDataURL('image/jpeg', 0.5);
            document.body.removeChild(container);
            
            return { ...game, preview };
          } catch (err) {
            console.error('Preview generation failed for game:', game.id, err);
            return game;
          }
        }));
        
        setGames(gamesWithPreviews);
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

  return { games, gamesLoading };
};
