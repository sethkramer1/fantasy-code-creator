
import React, { useState, useEffect } from 'react';
import { GameCard } from './GameCard';
import { GamesEmptyState } from './GamesEmptyState';
import { GamesLoadingState } from './GamesLoadingState';
import { GamesFilter } from './GamesFilter';
import { Game } from '@/types/game';
import { filterGames } from './utils/gamesListUtils';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (id: string) => void;
  onGameDelete: (id: string) => Promise<boolean>;
  filter?: string;
  itemsPerPage?: number;
}

export function GamesList({ 
  games, 
  isLoading, 
  onGameClick, 
  onGameDelete,
  filter = 'all',
  itemsPerPage = 9
}: GamesListProps) {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [gameCodeMap, setGameCodeMap] = useState<Record<string, string>>({});
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const filteredGames = filterGames(games, filter, user?.id);
  
  // Calculate filtered and paginated games
  const filteredAndTypedGames = filteredGames
    .filter(game => !selectedType || game.type === selectedType)
    .filter(game => !searchQuery || 
      game.prompt.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const totalPages = Math.ceil(filteredAndTypedGames.length / itemsPerPage);
  const currentGames = filteredAndTypedGames.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );
  
  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, selectedType, searchQuery]);
  
  // Fetch game codes for all games in the list
  useEffect(() => {
    if (currentGames.length === 0) return;
    
    const fetchGameCodes = async () => {
      setLoadingCodes(true);
      
      try {
        // Get the latest version for each game
        const { data: versions, error } = await supabase
          .from('game_versions')
          .select('game_id, code')
          .in('game_id', currentGames.map(game => game.id))
          .order('version_number', { ascending: false });
          
        if (error) {
          console.error("Error fetching game versions:", error);
          return;
        }
        
        if (!versions || versions.length === 0) {
          console.log("No game versions found");
          return;
        }
        
        // Create a map of game_id to the most recent code
        const codeMap: Record<string, string> = {};
        
        versions.forEach(version => {
          // Only set the code if it hasn't been set yet (first one is the most recent)
          if (!codeMap[version.game_id]) {
            codeMap[version.game_id] = version.code;
          }
        });
        
        setGameCodeMap(codeMap);
      } catch (fetchError) {
        console.error("Error in fetchGameCodes:", fetchError);
      } finally {
        setLoadingCodes(false);
      }
    };
    
    fetchGameCodes();
  }, [currentGames]);

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
        {currentGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            gameCode={gameCodeMap[game.id] || ""}
            onClick={() => {
              console.log("Game clicked with ID:", game.id);
              onGameClick(game.id);
            }}
            onDelete={onGameDelete}
            showVisibility={true}
          />
        ))}
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
