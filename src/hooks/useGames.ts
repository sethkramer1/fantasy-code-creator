
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
  }, [toast, user]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const deleteGame = async (gameId: string) => {
    try {
      // Check if user owns the game before attempting deletion
      const gameToDelete = games.find(game => game.id === gameId);
      
      if (gameToDelete && gameToDelete.user_id && user && gameToDelete.user_id !== user.id) {
        toast({
          title: "Cannot delete",
          description: "You can only delete your own designs",
          variant: "destructive"
        });
        return false;
      }
      
      // First, delete related records in game_messages table
      const { error: messagesError } = await supabase
        .from('game_messages')
        .delete()
        .eq('game_id', gameId);
      
      if (messagesError) {
        console.error("Error deleting game messages:", messagesError);
        // Continue with deletion even if messages deletion fails
      }
      
      // Delete records in game_versions table
      const { error: versionsError } = await supabase
        .from('game_versions')
        .delete()
        .eq('game_id', gameId);
      
      if (versionsError) {
        console.error("Error deleting game versions:", versionsError);
        // Continue with deletion even if versions deletion fails
      }
      
      // Delete records in token_usage table
      const { error: tokensError } = await supabase
        .from('token_usage')
        .delete()
        .eq('game_id', gameId);
      
      if (tokensError) {
        console.error("Error deleting token usage records:", tokensError);
        // Continue with deletion even if token usage deletion fails
      }
      
      // Finally, delete the game from the main games table
      const { error: gameError } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);
      
      if (gameError) throw gameError;
      
      // Update the local state by removing the deleted game
      setGames(currentGames => currentGames.filter(game => game.id !== gameId));
      
      toast({
        title: "Design deleted",
        description: "Your design has been removed successfully",
      });
      
      // Force a refresh of the games list to ensure everything is up to date
      fetchGames();
      
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
