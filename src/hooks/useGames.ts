
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
      console.log("=== DELETE OPERATION STARTED ===");
      console.log("Attempting to delete game with ID:", gameId);
      
      // Check if game exists in local state first
      const gameInState = games.find(game => game.id === gameId);
      
      if (!gameInState) {
        console.error("Game not found in local state!");
        toast({
          title: "Error deleting design",
          description: "The design could not be found in the current view",
          variant: "destructive"
        });
        return false;
      }
      
      // First delete related token_usage records
      console.log("Deleting related token_usage records for game ID:", gameId);
      const { error: tokenUsageError } = await supabase
        .from('token_usage')
        .delete()
        .eq('game_id', gameId);
      
      if (tokenUsageError) {
        console.error("Error deleting token usage records:", tokenUsageError);
        // Continue with deletion process even if this fails
      }
      
      // Also delete token_usage records that reference game_messages for this game
      console.log("Deleting token_usage records linked to game_messages for game ID:", gameId);
      
      // First, get all message IDs for this game
      const { data: messageIds, error: messageIdsError } = await supabase
        .from('game_messages')
        .select('id')
        .eq('game_id', gameId);
        
      if (messageIdsError) {
        console.error("Error fetching game message IDs:", messageIdsError);
      } else if (messageIds && messageIds.length > 0) {
        // Delete token_usage records referencing these message IDs
        const ids = messageIds.map(msg => msg.id);
        const { error: relatedTokenUsageError } = await supabase
          .from('token_usage')
          .delete()
          .in('message_id', ids);
          
        if (relatedTokenUsageError) {
          console.error("Error deleting token usage records for messages:", relatedTokenUsageError);
        }
      }
      
      // Then delete related game_versions
      console.log("Deleting related game_versions for game ID:", gameId);
      const { error: versionsError } = await supabase
        .from('game_versions')
        .delete()
        .eq('game_id', gameId);
      
      if (versionsError) {
        console.error("Error deleting game versions:", versionsError);
      }

      // Then delete related game_messages
      console.log("Deleting related game_messages for game ID:", gameId);
      const { error: messagesError } = await supabase
        .from('game_messages')
        .delete()
        .eq('game_id', gameId);
      
      if (messagesError) {
        console.error("Error deleting game messages:", messagesError);
      }
      
      // Finally delete the game itself - RLS will ensure only the owner can delete
      console.log("Now deleting main game record with ID:", gameId);
      const { data, error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId)
        .select();
      
      console.log("Delete game result:", { data, error });
      
      if (error) {
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
        // RLS might have prevented deletion without throwing an error
        toast({
          title: "Access denied",
          description: "You don't have permission to delete this design or it doesn't exist.",
          variant: "destructive"
        });
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
