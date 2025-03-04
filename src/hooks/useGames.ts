
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
      console.log("Fetching games, user is admin:", isAdmin);
      
      let query = supabase
        .from('games')
        .select('id, prompt, created_at, type, visibility, user_id, deleted')
        .eq('deleted', false);  // Only fetch non-deleted games
      
      // No additional filters needed - RLS should handle permissions
      // Public games should be visible to everyone, regardless of login status
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      console.log("Games fetched:", data?.length || 0, "games");
      
      // Log visibility for each game to help debugging
      if (data) {
        data.forEach(game => {
          console.log(`Game ID: ${game.id}, Visibility: ${game.visibility}, User ID: ${game.user_id || 'none'}`);
        });
      }
      
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
  }, [toast, isAdmin]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const deleteGame = async (gameId: string) => {
    try {
      console.log("=== DELETE OPERATION STARTED ===");
      console.log("Attempting to mark game with ID as deleted:", gameId);
      console.log("Current user ID:", user?.id);
      console.log("Is admin:", isAdmin);
      
      if (!user?.id) {
        console.error("User not logged in - cannot delete games");
        toast({
          title: "Access denied",
          description: "You must be logged in to delete designs",
          variant: "destructive"
        });
        return false;
      }
      
      // Optimistic UI update - remove the game from the UI immediately
      setGames(currentGames => currentGames.filter(game => game.id !== gameId));
      
      // Admin delete operation - no ownership check needed
      if (isAdmin) {
        console.log("Admin user - performing privileged delete");
        
        const { data, error } = await supabase
          .from('games')
          .update({ deleted: true })
          .eq('id', gameId)
          .select();
        
        console.log("Admin delete result:", { data, error });
        
        if (error) {
          console.error("Database error during admin delete:", error);
          // Revert optimistic update on error
          fetchGames();
          toast({
            title: "Error deleting design",
            description: error.message || "Database error, please try again",
            variant: "destructive"
          });
          return false;
        }
        
        toast({
          title: "Design deleted",
          description: "The design has been removed successfully",
        });
        
        console.log("=== ADMIN DELETE OPERATION COMPLETED SUCCESSFULLY ===");
        return true;
      }
      
      // For regular (non-admin) users, they can only delete their own games
      const { data, error } = await supabase
        .from('games')
        .update({ deleted: true })
        .match({ 
          id: gameId,
          user_id: user.id 
        })
        .select();
      
      console.log("Regular user delete result:", { data, error });
      
      if (error) {
        console.error("Database error during delete:", error);
        // Revert optimistic update on error
        fetchGames();
        toast({
          title: "Error deleting design",
          description: error.message || "Database error, please try again",
          variant: "destructive"
        });
        return false;
      }
      
      if (!data || data.length === 0) {
        console.error("No data returned - likely permission issue or game doesn't exist");
        // Revert optimistic update on error
        fetchGames();
        toast({
          title: "Access denied",
          description: "You don't have permission to delete this design or it doesn't exist",
          variant: "destructive"
        });
        return false;
      }
      
      console.log("Successfully marked game as deleted in database:", data);
      console.log("=== DELETE OPERATION COMPLETED SUCCESSFULLY ===");
      
      toast({
        title: "Design deleted",
        description: "Your design has been removed successfully",
      });
      
      return true;
    } catch (error) {
      console.error("=== DELETE OPERATION FAILED WITH EXCEPTION ===");
      console.error("Error in deleteGame function:", error);
      // Revert optimistic update on error
      fetchGames();
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
