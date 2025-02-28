
import { useState, useEffect } from "react";
import { Game } from "@/types/game";
import { supabase } from "@/integrations/supabase/client";

interface GameCodeVersion {
  id: string;
  code: string;
  version_number: number;
}

export const useGameVersions = (filteredGames: Game[]) => {
  const [gameCodeVersions, setGameCodeVersions] = useState<Record<string, string>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchGameVersions = async () => {
      try {
        setLoading(true);
        setFetchError(null);
        
        // Only fetch versions if there are filtered games to fetch for
        const gameIds = filteredGames.map(game => game.id);
        if (gameIds.length === 0) {
          setGameCodeVersions({});
          return;
        }
        
        // Fetch the latest version for each game
        const { data, error } = await supabase
          .from('game_versions')
          .select('id, game_id, code, version_number')
          .in('game_id', gameIds)
          .order('version_number', { ascending: false });
          
        if (error) throw error;
        
        // Create a map of gameId -> latest version code
        const latestVersions: Record<string, string> = {};
        
        // Group versions by game_id
        const gameVersionsMap: Record<string, GameCodeVersion[]> = {};
        
        if (data) {
          data.forEach(version => {
            if (!gameVersionsMap[version.game_id]) {
              gameVersionsMap[version.game_id] = [];
            }
            gameVersionsMap[version.game_id].push(version);
          });
          
          // Get the latest version for each game
          Object.entries(gameVersionsMap).forEach(([gameId, versions]) => {
            // Sort versions by version_number in descending order
            const sortedVersions = versions.sort((a, b) => b.version_number - a.version_number);
            if (sortedVersions.length > 0 && sortedVersions[0].code) {
              latestVersions[gameId] = sortedVersions[0].code;
            }
          });
        }
        
        setGameCodeVersions(latestVersions);
      } catch (error) {
        console.error("Error fetching game versions:", error);
        setFetchError("Failed to load game versions. Please try again later.");
        // Still set an empty object to prevent continuous retries
        setGameCodeVersions({});
      } finally {
        setLoading(false);
      }
    };
    
    fetchGameVersions();
  }, [JSON.stringify(filteredGames.map(game => game.id))]);  // Use stable dependency

  return { gameCodeVersions, fetchError, loading };
};
