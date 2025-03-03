
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
        setGamesLoading(true);
        const { data, error } = await supabase
          .from('games')
          .select('id, prompt, created_at, type')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setGames(data || []);
      } catch (error) {
        console.error("Error loading games:", error);
        toast({
          title: "Error loading games",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive"
        });
        // Set empty array to prevent the loading state from being stuck
        setGames([]);
      } finally {
        setGamesLoading(false);
      }
    };

    fetchGames();
  }, [toast]);

  return { games, gamesLoading };
};
