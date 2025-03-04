
import React from 'react';
import { GameCard } from './GameCard';
import { GamesEmptyState } from './GamesEmptyState';
import { GamesLoadingState } from './GamesLoadingState';
import { GamesFilter } from './GamesFilter';
import { Game } from '@/types/game';
import { filterGames } from './utils/gamesListUtils';
import { useAuth } from '@/context/AuthContext';

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (id: string) => void;
  onGameDelete: (id: string) => void;
  filter?: string;
}

export function GamesList({ 
  games, 
  isLoading, 
  onGameClick, 
  onGameDelete,
  filter = 'all'
}: GamesListProps) {
  const { user } = useAuth();
  const filteredGames = filterGames(games, filter, user?.id);
  
  if (isLoading) {
    return <GamesLoadingState />;
  }

  if (filteredGames.length === 0) {
    return <GamesEmptyState />;
  }

  return (
    <div className="space-y-6">
      <GamesFilter activeFilter={filter} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            onClick={() => {
              console.log("Game clicked with ID:", game.id); // Debug log
              onGameClick(game.id);
            }}
            onDelete={() => onGameDelete(game.id)}
          />
        ))}
      </div>
    </div>
  );
}
