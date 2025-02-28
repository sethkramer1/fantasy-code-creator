
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
          
          // Cast data to make TypeScript happy - we know this data matches the Game type
          setGames(data as Game[]);
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
              // Add thumbnail_url: null to each item
              const gamesWithNullThumbnail = basicData.map(game => ({
                ...game,
                thumbnail_url: null
              }));
              
              setGames(gamesWithNullThumbnail as Game[]);
              return;
            }
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
