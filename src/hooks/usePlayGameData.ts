
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export interface GameData {
  id: string;
  code: string;
  instructions: string | null;
  current_version: number | null;
  prompt: string;
}

export interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

export function usePlayGameData(gameId: string | undefined) {
  const navigate = useNavigate();
  const [game, setGame] = useState<GameData | null>(null);
  const [currentVersion, setCurrentVersion] = useState<GameVersion | undefined>(undefined);
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  const fetchGame = async () => {
    if (!gameId) return;

    setIsLoading(true);
    
    try {
      // First, check if the game exists
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      if (gameError) {
        console.error("Error fetching game:", gameError);
        toast({
          title: "Error fetching game",
          description: gameError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!gameData) {
        console.log("Game not found:", gameId);
        toast({
          title: "Game not found",
          description: "The requested game does not exist.",
          variant: "destructive",
        });
        navigate("/");
        setIsLoading(false);
        return;
      }

      setGame(gameData);
      console.log("Game data fetched successfully:", gameData.id);

      // Then, fetch the game versions
      const { data: versionData, error: versionError } = await supabase
        .from('game_versions')
        .select('*')
        .eq('game_id', gameId)
        .order('version_number', { ascending: false });

      if (versionError) {
        console.error("Error fetching game versions:", versionError);
        toast({
          title: "Error fetching game versions",
          description: versionError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!versionData || versionData.length === 0) {
        console.warn("No versions found for game:", gameId);
        // Create a default version from the game data to avoid UI issues
        const defaultVersion: GameVersion = {
          id: 'default-version',
          version_number: gameData.current_version || 1,
          code: gameData.code || "No content available",
          instructions: gameData.instructions || "No instructions available",
          created_at: gameData.created_at
        };
        
        setGameVersions([defaultVersion]);
        setCurrentVersion(defaultVersion);
      } else {
        console.log(`Found ${versionData.length} versions for game:`, gameId);
        setGameVersions(versionData);
        setCurrentVersion(versionData[0]);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching game data:", error);
      toast({
        title: "Error fetching game data",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  return {
    game,
    currentVersion,
    gameVersions,
    fetchGame,
    setGame,
    isLoading
  };
}
