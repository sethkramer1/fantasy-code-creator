
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

  const fetchGames = useCallback(async () => {
    try {
      setGamesLoading(true);
      console.log("Fetching games, user is admin:", isAdmin, "User ID:", user?.id);
      
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
  }, [toast, isAdmin, user?.id]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);
  
  // Refresh admin status and games when component mounts
  useEffect(() => {
    const refreshAdminStatus = async () => {
      if (user?.id) {
        const isUserAdmin = await checkIsAdmin();
        console.log("Admin status refreshed:", isUserAdmin);
        
        // Refetch games after admin status is updated
        if (isUserAdmin) {
          fetchGames();
        }
      }
    };
    
    refreshAdminStatus();
  }, [user?.id, checkIsAdmin, fetchGames]);

  const deleteGame = async (gameId: string) => {
    try {
      console.log("=== SOFT DELETE OPERATION STARTED ===");
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
      
      // Refresh admin status before proceeding with deletion
      await checkIsAdmin();
      
      // If user is an admin, they can delete any game
      if (isAdmin) {
        console.log("Admin user - bypassing ownership check");
        
        // First, get the game details to confirm it exists
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('id, prompt, user_id')
          .eq('id', gameId)
          .single();
        
        console.log("Game to be deleted by admin:", gameData);
        
        if (gameError) {
          console.error("Error fetching game before admin delete:", gameError);
          toast({
            title: "Error deleting design",
            description: gameError.message || "Could not find the design",
            variant: "destructive"
          });
          return false;
        }
        
        // Proceed with the deletion
        const { data, error } = await supabase
          .from('games')
          .update({ deleted: true })
          .eq('id', gameId)
          .select();
        
        console.log("Admin delete result:", { data, error });
        
        if (error) {
          console.error("Database error during admin delete:", error);
          toast({
            title: "Error deleting design",
            description: error.message || "Database error, please try again",
            variant: "destructive"
          });
          return false;
        }
        
        if (!data || data.length === 0) {
          console.error("No data returned - game doesn't exist or permission issue");
          toast({
            title: "Error deleting design",
            description: "This design doesn't exist or has already been deleted",
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
        toast({
          title: "Error deleting design",
          description: error.message || "Database error, please try again",
          variant: "destructive"
        });
        return false;
      }
      
      if (!data || data.length === 0) {
        console.error("No data returned - likely permission issue or game doesn't exist");
        toast({
          title: "Access denied",
          description: "You don't have permission to delete this design or it doesn't exist",
          variant: "destructive"
        });
        return false;
      }
      
      console.log("Successfully marked game as deleted in database:", data);
      console.log("=== SOFT DELETE OPERATION COMPLETED SUCCESSFULLY ===");
      
      // Update local state immediately without refetching
      setGames(currentGames => currentGames.filter(game => game.id !== gameId));
      
      toast({
        title: "Design deleted",
        description: "Your design has been removed successfully",
      });
      
      return true;
    } catch (error) {
      console.error("=== SOFT DELETE OPERATION FAILED WITH EXCEPTION ===");
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
