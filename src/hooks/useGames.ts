
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
        // Try to fetch all fields including the new thumbnail_url
        const { data, error } = await supabase
          .from('games')
          .select('id, prompt, created_at, code, type, instructions, current_version, thumbnail_url')
          .order('created_at', { ascending: false });
        
        if (error) {
          // If there's an error with the column, try again without thumbnail_url
          if (error.message.includes("column 'thumbnail_url' does not exist")) {
            console.warn("thumbnail_url column not found, fetching without it");
            const fallbackResult = await supabase
              .from('games')
              .select('id, prompt, created_at, code, type, instructions, current_version')
              .order('created_at', { ascending: false });
            
            if (fallbackResult.error) throw fallbackResult.error;
            
            // Map the results to include a null thumbnail_url field
            const gamesWithNullThumbnail = (fallbackResult.data || []).map(game => ({
              ...game,
              thumbnail_url: null
            }));
            
            setGames(gamesWithNullThumbnail);
          } else {
            throw error;
          }
        } else {
          setGames(data || []);
        }
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
