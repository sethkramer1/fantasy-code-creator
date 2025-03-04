
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
      console.log("=== DELETE OPERATION STARTED ===");
      console.log("Attempting to delete game with ID:", gameId);
      console.log("Current user:", user);
      
      // Check if game exists in local state first
      const gameInState = games.find(game => game.id === gameId);
      console.log("Game found in local state:", gameInState);
      
      if (!gameInState) {
        console.error("Game not found in local state!");
        toast({
          title: "Error deleting design",
          description: "The design could not be found in the current view",
          variant: "destructive"
        });
        return false;
      }
      
      // First delete related game_versions (if any)
      console.log("Deleting related game_versions for game ID:", gameId);
      const { error: versionsError } = await supabase
        .from('game_versions')
        .delete()
        .eq('game_id', gameId);
      
      console.log("Delete game_versions result:", { error: versionsError });

      // Then delete related game_messages (if any)
      console.log("Deleting related game_messages for game ID:", gameId);
      const { error: messagesError } = await supabase
        .from('game_messages')
        .delete()
        .eq('game_id', gameId);
      
      console.log("Delete game_messages result:", { error: messagesError });
      
      // Finally delete the game itself
      console.log("Now deleting main game record with ID:", gameId);
      const { data, error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId)
        .select();
      
      console.log("Delete game result:", { data, error });
      
      if (error) {
        console.error("Database error deleting game:", error);
        toast({
          title: "Error deleting design",
          description: error.message || "Database error, please try again",
          variant: "destructive"
        });
        return false;
      }
      
      if (!data || data.length === 0) {
        console.error("No records were deleted for game ID:", gameId);
        
        // Let's double check if the game exists in the database
        const { data: checkData, error: checkError } = await supabase
          .from('games')
          .select('id, user_id, visibility')
          .eq('id', gameId);
        
        console.log("Check if game exists:", { checkData, checkError });
        
        if (checkData && checkData.length > 0) {
          const gameRecord = checkData[0];
          console.log("Game exists but couldn't be deleted. Game record:", gameRecord);
          
          if (gameRecord.user_id !== user?.id) {
            console.error("User doesn't have permission to delete this game!");
            toast({
              title: "Access denied",
              description: "You don't have permission to delete this design.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Error deleting design",
              description: "The design exists but couldn't be deleted. Please try again later.",
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "Error deleting design",
            description: "The design could not be found in the database.",
            variant: "destructive"
          });
        }
        return false;
      }
      
      console.log("Successfully deleted game from database:", data);
      console.log("=== DELETE OPERATION COMPLETED SUCCESSFULLY ===");
      
      // Update local state immediately without refetching
      setGames(currentGames => currentGames.filter(game => game.id !== gameId));
      
      toast({
        title: "Design deleted",
        description: "Your design has been removed successfully",
      });
      
      return true;
    } catch (error) {
      console.error("=== DELETE OPERATION FAILED WITH EXCEPTION ===");
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
