
import React, { useState } from 'react';
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
  onGameDelete: (id: string) => Promise<boolean>;
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
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const filteredGames = filterGames(games, filter, user?.id);
  
  if (isLoading) {
    return <GamesLoadingState />;
  }

  if (filteredGames.length === 0) {
    return <GamesEmptyState 
      selectedType={selectedType}
      searchQuery={searchQuery}
      fetchError={null}
      viewMode={filter === 'my' ? 'user' : 'community'}
      isLoggedIn={!!user}
    />;
  }

  return (
    <div className="space-y-6">
      <GamesFilter
        games={filteredGames}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGames
          .filter(game => !selectedType || game.type === selectedType)
          .filter(game => !searchQuery || 
            game.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((game) => (
            <GameCard
              key={game.id}
              game={game}
              gameCode=""
              onClick={() => {
                console.log("Game clicked with ID:", game.id); // Debug log
                onGameClick(game.id);
              }}
              onDelete={onGameDelete}
              showVisibility={true}
            />
          ))}
      </div>
    </div>
  );
}
