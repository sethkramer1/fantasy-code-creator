
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export interface GameData {
  id: string;
  code: string;
  instructions: string | null;
  current_version: number | null;
  prompt: string;
  visibility?: string;
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
  const fetchAttemptsRef = useRef(0);
  const maxFetchAttempts = 3;

  const addSystemMessage = async (message: string, response: string) => {
    if (!gameId) return;
    
    try {
      await supabase
        .from('game_messages')
        .insert({
          game_id: gameId,
          message,
          response,
          is_system: true
        });
    } catch (error) {
      console.error("Error adding system message:", error);
    }
  };

  const fetchGame = async () => {
    if (!gameId) return;

    setIsLoading(true);
    fetchAttemptsRef.current += 1;
    
    try {
      // First, check if the game exists
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      if (gameError) {
        console.error("Error fetching game:", gameError);
        addSystemMessage(
          "Error fetching game", 
          `❌ ${gameError.message}`
        );
        setIsLoading(false);
        return;
      }

      if (!gameData) {
        console.log("Game not found:", gameId);
        
        // If we've tried multiple times and still can't find the game, redirect
        if (fetchAttemptsRef.current >= maxFetchAttempts) {
          addSystemMessage(
            "Game not found", 
            "❌ The requested game does not exist or is still being generated."
          );
          navigate("/");
          setIsLoading(false);
          return;
        }
        
        // If we haven't reached max attempts, we'll try again on next useEffect cycle
        setIsLoading(false);
        return;
      }

      // Reset the fetch attempts counter once we successfully get the game
      fetchAttemptsRef.current = 0;
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
        addSystemMessage(
          "Error fetching game versions", 
          `❌ ${versionError.message}`
        );
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
      addSystemMessage(
        "Error fetching game data", 
        `❌ ${error instanceof Error ? error.message : "An unexpected error occurred"}`
      );
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (gameId) {
      fetchGame();
      
      // If the game data wasn't loaded successfully and we haven't reached max attempts,
      // set up a retry mechanism
      const retryInterval = setInterval(() => {
        if (!game && fetchAttemptsRef.current < maxFetchAttempts) {
          console.log(`Retrying game fetch (attempt ${fetchAttemptsRef.current + 1}/${maxFetchAttempts})...`);
          fetchGame();
        } else {
          clearInterval(retryInterval);
        }
      }, 2000); // Retry every 2 seconds
      
      return () => clearInterval(retryInterval);
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
