
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Game } from "@/types/game";
import { useAuth } from "@/context/AuthContext";

export const useGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  const fetchGames = useCallback(async () => {
    try {
      setGamesLoading(true);
      
      // Build the basic query - no filters needed as RLS handles permissions
      const query = supabase
        .from('games')
        .select('id, prompt, created_at, type, visibility, user_id, deleted')
        .eq('deleted', false);
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Set the games data
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
  }, [toast]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const deleteGame = async (gameId: string) => {
    try {
      if (!user?.id) {
        toast({
          title: "Access denied",
          description: "You must be logged in to delete designs",
          variant: "destructive"
        });
        return false;
      }
      
      // If user is an admin, they can delete any game
      if (isAdmin) {
        // First, get the game details to confirm it exists
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('id')
          .eq('id', gameId)
          .single();
        
        if (gameError) {
          toast({
            title: "Error deleting design",
            description: gameError.message || "Could not find the design",
            variant: "destructive"
          });
          return false;
        }
        
        // Proceed with the deletion
        const { error } = await supabase
          .from('games')
          .update({ deleted: true })
          .eq('id', gameId);
        
        if (error) {
          toast({
            title: "Error deleting design",
            description: error.message || "Database error, please try again",
            variant: "destructive"
          });
          return false;
        }
        
        // Update local state
        setGames(currentGames => currentGames.filter(game => game.id !== gameId));
        
        toast({
          title: "Design deleted",
          description: "The design has been removed successfully",
        });
        
        return true;
      }
      
      // For regular users, they can only delete their own games
      const { error } = await supabase
        .from('games')
        .update({ deleted: true })
        .match({ 
          id: gameId,
          user_id: user.id 
        });
      
      if (error) {
        toast({
          title: "Error deleting design",
          description: error.message || "Database error, please try again",
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
      console.error("Error in deleteGame function:", error);
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
