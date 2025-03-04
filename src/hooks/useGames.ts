
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
        .select('id, prompt, created_at, type, visibility, user_id, deleted')
        .eq('deleted', false);  // Only fetch non-deleted games
      
      // With RLS, this will automatically filter to show only games the user has permission to see
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
      console.log("=== SOFT DELETE OPERATION STARTED ===");
      console.log("Attempting to mark game with ID as deleted:", gameId);
      console.log("Current user ID:", user?.id);
      
      // Skip the local state check as it might not be reliable
      // Directly attempt to update the game with both game ID and user ID conditions
      const { data, error } = await supabase
        .from('games')
        .update({ deleted: true })
        .match({ 
          id: gameId,
          // Only include user_id in the match if we have a logged in user
          ...(user?.id ? { user_id: user.id } : {})
        })
        .select();
      
      console.log("Update game result:", { data, error });
      
      if (error) {
        console.error("Database error during delete:", error);
        // Handle specific errors
        if (error.code === '42501') {
          // Permission denied error
          toast({
            title: "Access denied",
            description: "You don't have permission to delete this design.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error deleting design",
            description: error.message || "Database error, please try again",
            variant: "destructive"
          });
        }
        return false;
      }
      
      if (!data || data.length === 0) {
        console.error("No data returned - likely permission issue or game doesn't exist");
        // Try a more permissive update if the user is not logged in or we couldn't match with user ID
        if (!user?.id) {
          console.log("Attempting permissive update for public games...");
          const { data: publicData, error: publicError } = await supabase
            .from('games')
            .update({ deleted: true })
            .eq('id', gameId)
            .is('user_id', null)  // Only update games without a user_id
            .select();
            
          console.log("Permissive update result:", { publicData, publicError });
          
          if (publicError || !publicData || publicData.length === 0) {
            toast({
              title: "Access denied",
              description: "You don't have permission to delete this design or it doesn't exist.",
              variant: "destructive"
            });
            return false;
          }
          
          // If we get here, the permissive update worked
          setGames(currentGames => currentGames.filter(game => game.id !== gameId));
          toast({
            title: "Design deleted",
            description: "Your design has been removed successfully",
          });
          return true;
        }
        
        toast({
          title: "Access denied",
          description: "You don't have permission to delete this design or it doesn't exist.",
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
