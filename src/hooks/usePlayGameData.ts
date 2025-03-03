
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
  const { toast } = useToast();

  const fetchGame = async () => {
    if (!gameId) return;

    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        console.error("Error fetching game:", gameError);
        toast({
          title: "Error fetching game",
          description: gameError.message,
          variant: "destructive",
        });
        return;
      }

      if (!gameData) {
        toast({
          title: "Game not found",
          description: "The requested game does not exist.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setGame(gameData);

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
        return;
      }

      setGameVersions(versionData);
      setCurrentVersion(versionData[0]);
    } catch (error) {
      console.error("Error fetching game data:", error);
      toast({
        title: "Error fetching game data",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchGame();
  }, [gameId, navigate, toast]);

  return {
    game,
    currentVersion,
    gameVersions,
    fetchGame,
    setGame
  };
}
