
import { useState } from "react";
import { Game } from "@/types/game";
import { GamesFilter } from "./GamesFilter";
import { GameCard } from "./GameCard";
import { GamesEmptyState } from "./GamesEmptyState";
import { GamesLoadingState } from "./GamesLoadingState";
import { useGameVersions } from "@/hooks/useGameVersions";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (gameId: string) => void;
}

export function GamesList({
  games,
  isLoading,
  onGameClick
}: GamesListProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Filter games based on selected type and search query
  const filteredGames = games.filter(game => {
    const matchesType = !selectedType || game.type === selectedType;
    const matchesSearch = !searchQuery || 
      (game.prompt && game.prompt.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Fetch game versions for filtered games
  const { gameCodeVersions, fetchError, loading: versionsLoading } = useGameVersions(filteredGames);

  return (
    <div className="glass-panel p-8 card-shadow">
      <GamesFilter 
        games={games}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      
      {isLoading ? (
        <GamesLoadingState />
      ) : fetchError ? (
        <GamesEmptyState 
          selectedType={selectedType} 
          searchQuery={searchQuery} 
          fetchError={fetchError} 
        />
      ) : filteredGames.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredGames.map(game => (
            <GameCard
              key={game.id}
              game={game}
              gameCode={gameCodeVersions[game.id]}
              onClick={() => onGameClick(game.id)}
            />
          ))}
        </div>
      ) : (
        <GamesEmptyState 
          selectedType={selectedType} 
          searchQuery={searchQuery} 
          fetchError={null} 
        />
      )}
    </div>
  );
}
