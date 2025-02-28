
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
        // First attempt: Try to fetch with thumbnail_url column
        const response = await supabase
          .from('games')
          .select('id, prompt, created_at, code, type, instructions, current_version, thumbnail_url')
          .order('created_at', { ascending: false });
        
        if (response.error) {
          // Check for any variation of "thumbnail_url does not exist" error message
          if (response.error.message.includes("thumbnail_url") && response.error.message.includes("does not exist")) {
            console.warn("thumbnail_url column not found, fetching without it");
            
            // Second attempt: Try without thumbnail_url
            const basicResponse = await supabase
              .from('games')
              .select('id, prompt, created_at, code, type, instructions, current_version')
              .order('created_at', { ascending: false });
            
            if (basicResponse.error) {
              throw basicResponse.error;
            }
            
            // If no error, process the data
            const processedGames = processGamesData(basicResponse.data || [], true);
            setGames(processedGames);
          } else {
            // For any other error, throw it to be caught by the outer catch
            throw response.error;
          }
        } else {
          // If no error, process the data
          const processedGames = processGamesData(response.data || [], false);
          setGames(processedGames);
        }
      } catch (error) {
        console.error("Error loading games:", error);
        toast({
          title: "Error loading games",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive"
        });
        // On error, set games to empty array
        setGames([]);
      } finally {
        setGamesLoading(false);
      }
    };

    // Helper function to process and validate games data
    const processGamesData = (data: any[], addThumbnail: boolean): Game[] => {
      if (!Array.isArray(data)) {
        return [];
      }
      
      return data
        .filter(item => 
          item && 
          typeof item === 'object' && 
          'id' in item && 
          'prompt' in item && 
          'code' in item
        )
        .map(item => {
          if (addThumbnail) {
            return {
              ...item,
              thumbnail_url: null
            } as Game;
          }
          return item as Game;
        });
    };

    fetchGames();
  }, [toast]);

  return { games, gamesLoading };
};
