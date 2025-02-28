
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
        try {
          const { data, error } = await supabase
            .from('games')
            .select('id, prompt, created_at, code, type, instructions, current_version, thumbnail_url')
            .order('created_at', { ascending: false });
          
          if (error) {
            throw error;
          }
          
          // Ensure data is an array before using it
          if (Array.isArray(data)) {
            // Validate each item has the required Game properties
            const validGames = data.filter((item): item is Game => 
              typeof item === 'object' && 
              item !== null &&
              'id' in item && 
              'prompt' in item && 
              'code' in item
            );
            
            setGames(validGames);
            return;
          }
          
          // If data is not an array, set empty array
          setGames([]);
          return;
          
        } catch (error: any) {
          // Only catch and retry if the specific error is about thumbnail_url column
          if (error?.message?.includes("column 'thumbnail_url' does not exist")) {
            console.warn("thumbnail_url column not found, fetching without it");
            
            // Second attempt: Try without thumbnail_url
            const { data: basicData, error: basicError } = await supabase
              .from('games')
              .select('id, prompt, created_at, code, type, instructions, current_version')
              .order('created_at', { ascending: false });
            
            if (basicError) {
              throw basicError;
            }
            
            if (Array.isArray(basicData)) {
              // Validate each item has the required Game properties
              const validBasicGames = basicData.filter((item): item is Omit<Game, 'thumbnail_url'> => 
                typeof item === 'object' && 
                item !== null &&
                'id' in item && 
                'prompt' in item && 
                'code' in item
              );
              
              // Add thumbnail_url: null to each item
              const gamesWithNullThumbnail = validBasicGames.map(game => ({
                ...game,
                thumbnail_url: null
              }));
              
              setGames(gamesWithNullThumbnail);
              return;
            }
            
            // If basicData is not an array, set empty array
            setGames([]);
            return;
          } else {
            // For any other error, just throw it to be caught by the outer catch
            throw error;
          }
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

    fetchGames();
  }, [toast]);

  return { games, gamesLoading };
};
