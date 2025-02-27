
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
        const { data, error } = await supabase
          .from('games')
          .select('id, prompt, created_at, code, type')
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

  return { games, gamesLoading };
};
