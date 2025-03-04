
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Game } from "@/types/game";
import { useAuth } from "@/context/AuthContext";

export const useGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchGames = useCallback(async () => {
    try {
      setGamesLoading(true);
      
      let query = supabase
        .from('games')
        .select('id, prompt, created_at, type, visibility, user_id');
      
      if (user) {
        query = query.or(`visibility.eq.public,and(visibility.eq.private,user_id.eq.${user.id})`);
      } else {
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
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const deleteGame = async (gameId: string) => {
    try {
      const gameToDelete = games.find(game => game.id === gameId);
      
      if (gameToDelete && gameToDelete.user_id && user && gameToDelete.user_id !== user.id) {
        toast({
          title: "Cannot delete",
          description: "You can only delete your own designs",
          variant: "destructive"
        });
        return false;
      }
      
      console.log("Deleting game with ID:", gameId);
      
      // Delete directly from the games table
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);
      
      if (error) {
        console.error("Error deleting game:", error);
        toast({
          title: "Error deleting design",
          description: error.message || "Please try again",
          variant: "destructive"
        });
        return false;
      }
      
      // Update local state immediately without refetching
      setGames(currentGames => currentGames.filter(game => game.id !== gameId));
      
      toast({
        title: "Design deleted",
        description: "Your design has been removed successfully",
      });
      
      return true;
    } catch (error) {
      console.error("Error deleting game:", error);
      toast({
        title: "Error deleting design",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
      return false;
    }
  };

  return { games, gamesLoading, deleteGame, refreshGames: fetchGames };
};
