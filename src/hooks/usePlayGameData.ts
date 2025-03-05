import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ModelType } from "@/types/generation";
import { useAuth } from "@/context/AuthContext";

export interface GameData {
  id: string;
  code: string;
  instructions: string | null;
  current_version: number | null;
  prompt: string;
  visibility?: string;
  model_type?: string;
  deleted?: boolean;
  user_id?: string;
  name?: string;
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
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const fetchAttemptsRef = useRef(0);
  const maxFetchAttempts = 3;
  const authRetryAttemptsRef = useRef(0);
  const maxAuthRetryAttempts = 5;
  const { user, loading: isAuthLoading } = useAuth();

  const addSystemMessage = async (message: string, response: string, modelType: string = "smart") => {
    if (!gameId) return;
    
    try {
      await supabase
        .from('game_messages')
        .insert({
          game_id: gameId,
          message,
          response,
          is_system: true,
          model_type: modelType
        });
    } catch (error) {
      console.error("Error adding system message:", error);
    }
  };

  // Function to check if the user is the owner of the game
  const checkIsOwner = (gameUserId: string | null | undefined) => {
    if (!gameUserId) return false;
    
    // Check if current user matches game user_id
    if (user?.id === gameUserId) return true;
    
    // Check local storage as fallback for ownership
    const ownedGames = JSON.parse(localStorage.getItem('ownedGames') || '{}');
    return !!ownedGames[gameId || ''];
  };
  
  // Function to remember game ownership
  const rememberGameOwnership = (gameUserId: string | null | undefined) => {
    if (!gameId || !user || !gameUserId) return;
    
    // If the current user is the owner, store this information
    if (user.id === gameUserId) {
      const ownedGames = JSON.parse(localStorage.getItem('ownedGames') || '{}');
      ownedGames[gameId] = true;
      localStorage.setItem('ownedGames', JSON.stringify(ownedGames));
      console.log("Stored game ownership in local storage:", gameId);
    }
  };

  const fetchGame = async () => {
    if (!gameId) return;

    // If auth is still loading and we haven't exceeded max retries, delay and retry
    if (isAuthLoading && authRetryAttemptsRef.current < maxAuthRetryAttempts) {
      console.log(`Auth still loading, retrying in 500ms (attempt ${authRetryAttemptsRef.current + 1}/${maxAuthRetryAttempts})`);
      authRetryAttemptsRef.current += 1;
      setTimeout(fetchGame, 500);
      return;
    }

    setIsLoading(true);
    fetchAttemptsRef.current += 1;
    
    try {
      console.log("Fetching game data for ID:", gameId);
      // RLS policies will handle access control
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*, user_id')
        .eq('id', gameId)
        .maybeSingle();

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
        
        if (fetchAttemptsRef.current >= maxFetchAttempts) {
          addSystemMessage(
            "Game not found", 
            "❌ The requested game does not exist or is still being generated."
          );
          navigate("/");
          setIsLoading(false);
          return;
        }
        
        setIsLoading(false);
        return;
      }
      
      // Check if game is deleted
      if (gameData.deleted) {
        console.log("Game is deleted:", gameId);
        setGame(gameData);
        setIsLoading(false);
        return;
      }

      // Remember game ownership for future visits
      rememberGameOwnership(gameData.user_id);

      // Check visibility permissions
      const isOwner = checkIsOwner(gameData.user_id);
      const isPublic = gameData.visibility === 'public';
      const isUnlisted = gameData.visibility === 'unlisted';
      
      console.log("Access check:", { 
        isOwner, 
        isPublic, 
        isUnlisted, 
        userId: user?.id, 
        gameUserId: gameData.user_id,
        visibility: gameData.visibility,
        authLoading: isAuthLoading
      });
      
      // If auth is still loading and this is the owner's content, don't deny access yet
      if (isAuthLoading && gameData.visibility === 'private') {
        console.log("Auth still loading and content is private, delaying access check");
        authRetryAttemptsRef.current += 1;
        if (authRetryAttemptsRef.current < maxAuthRetryAttempts) {
          setTimeout(fetchGame, 500);
          return;
        }
      }
      
      if (!isPublic && !isUnlisted && !isOwner) {
        console.log("Access denied: Game is private and user is not the owner");
        setAccessDenied(true);
        setIsLoading(false);
        addSystemMessage(
          "Access denied", 
          "❌ This content is private and can only be viewed by its creator."
        );
        return;
      } else {
        // Reset access denied if it was previously set
        setAccessDenied(false);
      }

      console.log("Game data fetched successfully:", gameData.id, "Visibility:", gameData.visibility);
      fetchAttemptsRef.current = 0;
      authRetryAttemptsRef.current = 0;
      setGame(gameData);

      console.log("Fetching versions for game:", gameId);
      // RLS policies will handle access control for versions
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
      
      const retryInterval = setInterval(() => {
        if (!game && fetchAttemptsRef.current < maxFetchAttempts) {
          console.log(`Retrying game fetch (attempt ${fetchAttemptsRef.current + 1}/${maxFetchAttempts})...`);
          fetchGame();
        } else {
          clearInterval(retryInterval);
        }
      }, 2000);
      
      return () => clearInterval(retryInterval);
    }
  }, [gameId]);

  return {
    game,
    currentVersion,
    gameVersions,
    fetchGame,
    setGame,
    isLoading,
    accessDenied,
    modelType: game?.model_type as ModelType || "smart"
  };
}
