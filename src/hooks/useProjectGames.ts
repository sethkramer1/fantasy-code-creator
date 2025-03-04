
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectGame } from "@/types/project";
import { Game } from "@/types/game";
import { useToast } from "@/hooks/use-toast";

export function useProjectGames(projectId?: string) {
  const [projectGames, setProjectGames] = useState<{game: Game, projectGame: ProjectGame}[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProjectGames = async () => {
    if (!projectId) {
      setProjectGames([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('project_games')
        .select(`
          *,
          games:game_id (*)
        `)
        .eq('project_id', projectId)
        .order('added_at', { ascending: false });
        
      if (error) throw error;
      
      const formattedData = (data || []).map(item => ({
        game: item.games as Game,
        projectGame: {
          id: item.id,
          project_id: item.project_id,
          game_id: item.game_id,
          added_at: item.added_at,
          added_by: item.added_by
        } as ProjectGame
      }));
      
      setProjectGames(formattedData);
    } catch (error) {
      console.error("Error fetching project games:", error);
      toast({
        title: "Error",
        description: "Failed to load games for this project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addGameToProject = async (gameId: string) => {
    if (!projectId) return null;
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!userData.user) throw new Error("User not authenticated");

      // Check if game is already in the project
      const { data: existingGame, error: checkError } = await supabase
        .from('project_games')
        .select('id')
        .eq('project_id', projectId)
        .eq('game_id', gameId)
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      if (existingGame) {
        toast({
          title: "Already added",
          description: "This game is already in the project.",
        });
        return null;
      }

      const { data, error } = await supabase
        .from('project_games')
        .insert([
          { 
            project_id: projectId,
            game_id: gameId,
            added_by: userData.user.id 
          }
        ])
        .select()
        .single();
        
      if (error) throw error;
      
      await fetchProjectGames();
      
      toast({
        title: "Success",
        description: "Game added to project successfully.",
      });
      
      return data;
    } catch (error) {
      console.error("Error adding game to project:", error);
      toast({
        title: "Error",
        description: "Failed to add game to project. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const removeGameFromProject = async (projectGameId: string) => {
    try {
      const { error } = await supabase
        .from('project_games')
        .delete()
        .eq('id', projectGameId);
        
      if (error) throw error;
      
      await fetchProjectGames();
      
      toast({
        title: "Success",
        description: "Game removed from project successfully.",
      });
      
      return true;
    } catch (error) {
      console.error("Error removing game from project:", error);
      toast({
        title: "Error",
        description: "Failed to remove game from project. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Fetch project games when projectId changes
  useEffect(() => {
    fetchProjectGames();
  }, [projectId]);

  return {
    projectGames,
    loading,
    fetchProjectGames,
    addGameToProject,
    removeGameFromProject
  };
}
