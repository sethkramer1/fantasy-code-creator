
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Game } from "@/types/game";
import { useAuth } from "@/context/AuthContext";

export const useGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setGamesLoading(true);
        
        // Create a query that:
        // 1. Shows public games for everyone
        // 2. Shows the user's private games if they're logged in
        let query = supabase
          .from('games')
          .select('id, prompt, created_at, type, visibility, user_id');
        
        if (user) {
          // If user is logged in, show:
          // - public games OR
          // - private games that belong to the current user
          query = query.or(`visibility.eq.public,and(visibility.eq.private,user_id.eq.${user.id})`);
        } else {
          // If not logged in, only show public games
          query = query.eq('visibility', 'public');
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
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
  }, [toast, user]);

  return { games, gamesLoading };
};
