
import { useState } from "react";
import { Game, contentTypes } from "@/types/game";
import { Loader2, ArrowUpRight, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (gameId: string) => void;
}

// Function to get type label and badge color
function getTypeInfo(type?: string) {
  if (!type) return { label: 'Unknown', badgeColor: 'bg-gray-100 text-gray-800' };
  
  const contentType = contentTypes.find(t => t.id === type);
  const label = contentType ? contentType.label : 'Unknown';
  
  const badgeColors: Record<string, string> = {
    'game': 'bg-blue-100 text-blue-800',
    'svg': 'bg-pink-100 text-pink-800',
    'webdesign': 'bg-indigo-100 text-indigo-800',
    'dataviz': 'bg-green-100 text-green-800',
    'diagram': 'bg-orange-100 text-orange-800',
    'infographic': 'bg-yellow-100 text-yellow-800'
  };
  
  return { 
    label, 
    badgeColor: badgeColors[type] || 'bg-gray-100 text-gray-800'
  };
}

export function GamesList({
  games,
  isLoading,
  onGameClick
}: GamesListProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Calculate counts for each content type
  const typeCounts = games.reduce((counts: Record<string, number>, game) => {
    if (game.type) {
      counts[game.type] = (counts[game.type] || 0) + 1;
    }
    return counts;
  }, {});
  
  // Filter games based on selected type and search query
  const filteredGames = games.filter(game => {
    const matchesType = !selectedType || game.type === selectedType;
    const matchesSearch = !searchQuery || 
      (game.prompt && game.prompt.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="glass-panel p-8 card-shadow">
      <div className="mb-6">
        {/* Search box */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search your projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 bg-white border border-gray-200 rounded-lg shadow-sm focus:border-blue-300 text-gray-800"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex overflow-x-auto pb-1 gap-2">
          {/* All filter tab */}
          <button
            onClick={() => setSelectedType("")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              selectedType === ""
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-white text-xs">
              {games.length}
            </span>
          </button>
          
          {contentTypes.map((type) => {
            const count = typeCounts[type.id] || 0;
            const isDisabled = count === 0;
            
            return (
              <button
                key={type.id}
                onClick={() => !isDisabled && setSelectedType(type.id === selectedType ? "" : type.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  type.id === selectedType
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDisabled
                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={isDisabled}
              >
                {type.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  type.id === selectedType
                    ? 'bg-white/20 text-white'
                    : isDisabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-gray-200 text-gray-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl overflow-hidden border border-gray-100">
              <Skeleton className="h-28 w-full" />
              <div className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredGames.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredGames.map(game => {
            const { label, badgeColor } = getTypeInfo(game.type);
            
            return (
              <div 
                key={game.id}
                className="rounded-xl bg-white border border-gray-100 hover:border-blue-200 transition-all text-left group p-4 cursor-pointer hover-scale card-shadow"
                onClick={() => onGameClick(game.id)}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-2 flex-1">
                    <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {game.prompt}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      {game.type && (
                        <span className={`text-xs px-2.5 py-1 rounded-full ${badgeColor} whitespace-nowrap flex-shrink-0 font-medium`}>
                          {label.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-1.5 rounded-full bg-gray-50 group-hover:bg-blue-50 transition-colors">
                    <ArrowUpRight size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-gray-500 mb-2">
            {selectedType 
              ? `No ${contentTypes.find(t => t.id === selectedType)?.label || selectedType} projects found.` 
              : "No projects have been created yet."}
          </p>
          <p className="text-gray-600 font-medium">
            {searchQuery ? "Try a different search term." : "Create your first project by filling out the form above!"}
          </p>
        </div>
      )}
    </div>
  );
}
