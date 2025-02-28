
import { Game, contentTypes } from "@/types/game";
import { Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [selectedType, setSelectedType] = useState<string>("all");

  // Filter games based on selected type
  const filteredGames = useMemo(() => {
    if (selectedType === "all") {
      return games;
    }
    return games.filter(game => game.type === selectedType);
  }, [games, selectedType]);

  // Count games by type for tab labels
  const gameCounts = useMemo(() => {
    const counts: Record<string, number> = { all: games.length };
    
    contentTypes.forEach(type => {
      counts[type.id] = games.filter(game => game.type === type.id).length;
    });
    
    return counts;
  }, [games]);

  return (
    <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-medium text-gray-900 mb-4">My History</h2>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : games.length > 0 ? (
        <Tabs defaultValue="all" value={selectedType} onValueChange={setSelectedType}>
          <TabsList className="grid grid-cols-3 md:grid-cols-7 mb-6">
            <TabsTrigger value="all" className="text-xs">
              All ({gameCounts.all})
            </TabsTrigger>
            {contentTypes.map(type => (
              <TabsTrigger 
                key={type.id} 
                value={type.id} 
                className="text-xs"
                disabled={gameCounts[type.id] === 0}
              >
                {type.label.split(' ')[0]} ({gameCounts[type.id]})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <div className="grid gap-4 md:grid-cols-2">
              {games.map(game => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  onGameClick={onGameClick} 
                />
              ))}
            </div>
          </TabsContent>

          {contentTypes.map(type => (
            <TabsContent key={type.id} value={type.id} className="mt-0">
              {filteredGames.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredGames.map(game => (
                    <GameCard 
                      key={game.id} 
                      game={game} 
                      onGameClick={onGameClick} 
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No {type.label.toLowerCase()} content has been created yet.
                </p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-center text-gray-500 py-8">
          No games have been created yet. Be the first to create one!
        </p>
      )}
    </div>
  );
}

// Extract GameCard to a separate component to improve code organization
function GameCard({ game, onGameClick }: { game: Game; onGameClick: (gameId: string) => void }) {
  // Function to get badge color based on content type
  const getTypeBadgeColor = (type?: string) => {
    switch(type) {
      case 'game': return 'bg-blue-100 text-blue-800';
      case 'svg': return 'bg-pink-100 text-pink-800';
      case 'webdesign': return 'bg-purple-100 text-purple-800';
      case 'dataviz': return 'bg-green-100 text-green-800';
      case 'diagram': return 'bg-orange-100 text-orange-800';
      case 'infographic': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Function to get type label
  const getTypeLabel = (type?: string) => {
    if (!type) return 'Unknown';
    const contentType = contentTypes.find(t => t.id === type);
    return contentType ? contentType.label : 'Unknown';
  };

  return (
    <div className="rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group relative overflow-hidden">
      <button 
        onClick={() => onGameClick(game.id)} 
        className="p-4 w-full text-left"
      >
        <div className="flex justify-between items-start">
          <p className="font-medium text-gray-700 group-hover:text-black transition-colors line-clamp-2">
            {game.prompt}
          </p>
          {game.type && (
            <span className={`text-xs px-2 py-1 rounded-full ${getTypeBadgeColor(game.type)} ml-2 whitespace-nowrap flex-shrink-0`}>
              {getTypeLabel(game.type).split(' ')[0]}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {new Date(game.created_at).toLocaleDateString()}
        </p>
      </button>
    </div>
  );
}
