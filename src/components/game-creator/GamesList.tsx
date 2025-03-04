
import { useState, useEffect, useMemo } from "react";
import { Game } from "@/types/game";
import { GamesFilter } from "./GamesFilter";
import { GameCard } from "./GameCard";
import { GamesEmptyState } from "./GamesEmptyState";
import { GamesLoadingState } from "./GamesLoadingState";
import { useGameVersions } from "@/hooks/useGameVersions";
import { useAuth } from "@/context/AuthContext";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (gameId: string) => void;
  onGameDelete?: (gameId: string) => Promise<boolean>;
}

export function GamesList({
  games,
  isLoading,
  onGameClick,
  onGameDelete
}: GamesListProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"user" | "community">("community");
  const pageSize = 9; // Number of designs per page
  const { user, checkIsAdmin } = useAuth();
  
  // Force admin status check on component mount
  useEffect(() => {
    const refreshAdminStatus = async () => {
      await checkIsAdmin();
      console.log("Admin status refreshed in GamesList");
    };
    refreshAdminStatus();
  }, [checkIsAdmin]);
  
  // Check if user has any designs
  const userHasDesigns = useMemo(() => {
    if (!user) return false;
    return games.some(game => game.user_id === user.id);
  }, [games, user]);

  // Set initial view mode based on user status and if they have designs
  useEffect(() => {
    if (user && userHasDesigns) {
      setViewMode("user");
    } else {
      setViewMode("community");
    }
  }, [user, userHasDesigns]);
  
  // Filter games based on view mode and other filters
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      // If not logged in, only show public designs
      if (!user) {
        return game.visibility === "public";
      }
      
      // Filter by view mode
      if (viewMode === "user") {
        // Only show user's designs
        if (user && game.user_id !== user.id) {
          return false;
        }
      } else if (viewMode === "community") {
        // Show all public designs
        if (game.visibility !== "public") {
          return false;
        }
      }
      
      // Apply type and search filters
      const matchesType = !selectedType || game.type === selectedType;
      const matchesSearch = !searchQuery || 
        (game.prompt && game.prompt.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [games, selectedType, searchQuery, viewMode, user]);

  // Reset to first page when filters or view mode change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, searchQuery, viewMode]);

  // Calculate pagination values
  const totalPages = Math.max(1, Math.ceil(filteredGames.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredGames.length);
  
  // Use useMemo for paginatedGames to prevent unnecessary recalculations
  const paginatedGames = useMemo(() => {
    return filteredGames.slice(startIndex, endIndex);
  }, [filteredGames, startIndex, endIndex]);

  // Handle page navigation
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Fetch game versions for paginated games only
  const { gameCodeVersions, fetchError, loading: versionsLoading } = useGameVersions(paginatedGames);

  return (
    <div className="glass-panel p-8 card-shadow">
      <Tabs
        defaultValue={viewMode}
        value={viewMode}
        onValueChange={(value) => setViewMode(value as "user" | "community")}
        className="mb-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="user" disabled={!user}>Your Designs</TabsTrigger>
          <TabsTrigger value="community">Community Designs</TabsTrigger>
        </TabsList>
      </Tabs>
      
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
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                gameCode={gameCodeVersions[game.id]}
                onClick={() => onGameClick(game.id)}
                onDelete={onGameDelete}
                showVisibility={true}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={goToPreviousPage} 
                      className={currentPage === 1 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem className="flex items-center justify-center px-4">
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext 
                      onClick={goToNextPage} 
                      className={currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      ) : (
        <GamesEmptyState 
          selectedType={selectedType} 
          searchQuery={searchQuery} 
          fetchError={null}
          viewMode={viewMode}
          isLoggedIn={!!user}
        />
      )}
    </div>
  );
}
