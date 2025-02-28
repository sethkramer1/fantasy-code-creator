
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Game } from "@/types/game";

export const useGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // First, try to fetch all fields including thumbnail_url
        const result = await supabase
          .from('games')
          .select('id, prompt, created_at, code, type, instructions, current_version, thumbnail_url')
          .order('created_at', { ascending: false });
        
        if (result.error) {
          // If the error is about thumbnail_url column not existing
          if (result.error.message.includes("column 'thumbnail_url' does not exist")) {
            console.warn("thumbnail_url column not found, fetching without it");
            
            // Try again without the thumbnail_url column
            const basicResult = await supabase
              .from('games')
              .select('id, prompt, created_at, code, type, instructions, current_version')
              .order('created_at', { ascending: false });
            
            if (basicResult.error) {
              throw basicResult.error;
            }
            
            // Map each game to include a null thumbnail_url
            const gamesWithNullThumbnail = (basicResult.data || []).map(game => ({
              ...game,
              thumbnail_url: null
            }));
            
            setGames(gamesWithNullThumbnail);
          } else {
            // If it's another kind of error, throw it
            throw result.error;
          }
        } else {
          // If successful, set the games data
          setGames(result.data || []);
        }
      } catch (error) {
        console.error("Error loading games:", error);
        toast({
          title: "Error loading games",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive"
        });
        // Even on error, set empty array to avoid undefined
        setGames([]);
      } finally {
        setGamesLoading(false);
      }
    };

    fetchGames();
  }, [toast]);

  return { games, gamesLoading };
};
