import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Game } from "@/types/game";
import { useAuth } from "@/context/AuthContext";

export const useGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const { toast } = useToast();
  const { user, isAdmin, checkIsAdmin } = useAuth();

  // Ensure we always have the latest admin status before critical operations
  const refreshAdminStatus = useCallback(async () => {
    console.log("Refreshing admin status before critical operation");
    const isUserAdmin = await checkIsAdmin();
    console.log("Refreshed admin status:", isUserAdmin);
    return isUserAdmin;
  }, [checkIsAdmin]);

  const fetchGames = useCallback(async () => {
    try {
      setGamesLoading(true);
      
      // Refresh admin status before fetching games
      const isUserAdmin = await refreshAdminStatus();
      console.log("Fetching games, user is admin:", isUserAdmin, "user email:", user?.email);
      
      let query = supabase
        .from('games')
        .select('id, prompt, created_at, type, visibility, user_id, deleted, name')
        .eq('deleted', false);  // Only fetch non-deleted games
      
      // If user is not logged in, only show public games
      if (!user) {
        console.log("User not logged in - only fetching public games");
        query = query.eq('visibility', 'public');
      } else if (!isUserAdmin) {
        // If user is logged in but not admin, show public games and their own games
        // Note: Unlisted games should only be accessible via direct link, not listed in the games list
        console.log("Regular user logged in - fetching public games and user's own games");
        query = query.or(`visibility.eq.public,user_id.eq.${user.id}`);
      }
      // If user is admin, they can see all games (no additional filter needed)
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      console.log("Games fetched:", data?.length || 0, "games");
      
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
  }, [toast, user, refreshAdminStatus, isAdmin]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const deleteGame = async (gameId: string) => {
    try {
      // Force refresh admin status before delete operation
      const isUserAdmin = await refreshAdminStatus();
      
      console.log("=== DELETE OPERATION STARTED ===");
      console.log("Deleting game ID:", gameId);
      console.log("User ID:", user?.id);
      console.log("User Email:", user?.email);
      console.log("Is admin (freshly checked):", isUserAdmin);
      
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
      
      // DIFFERENT DELETE PATHS FOR ADMIN VS REGULAR USERS
      if (isUserAdmin) {
        console.log("ADMIN DELETE PATH: Admin user is attempting to delete game:", gameId);
        
        // Admin can delete any game with a simple query
        const { error } = await supabase
          .from('games')
          .update({ deleted: true })
          .eq('id', gameId);
        
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
        
        console.log("Admin delete successful for game:", gameId);
        toast({
          title: "Design deleted",
          description: "The design has been removed successfully",
        });
        
        return true;
      } else {
        console.log("REGULAR USER DELETE PATH: Users can only delete their own games");
        
        // Regular users can only delete their own games
        const { data, error } = await supabase
          .from('games')
          .update({ deleted: true })
          .match({ 
            id: gameId,
            user_id: user.id 
          })
          .select();
        
        if (error) {
          console.error("Database error during user delete:", error);
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
          console.error("No games affected - likely permission issue");
          // Revert optimistic update on error
          fetchGames();
          toast({
            title: "Access denied",
            description: "You don't have permission to delete this design",
            variant: "destructive"
          });
          return false;
        }
        
        console.log("User delete successful for game:", gameId);
        toast({
          title: "Design deleted",
          description: "Your design has been removed successfully",
        });
        
        return true;
      }
    } catch (error) {
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
