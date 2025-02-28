
import { useState, useEffect } from "react";
import { Game, contentTypes } from "@/types/game";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
    'webdesign': 'bg-purple-100 text-purple-800',
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
  
  // Calculate counts for each content type
  const typeCounts = games.reduce((counts: Record<string, number>, game) => {
    if (game.type) {
      counts[game.type] = (counts[game.type] || 0) + 1;
    }
    return counts;
  }, {});
  
  // Filter games based on selected type
  const filteredGames = selectedType 
    ? games.filter(game => game.type === selectedType)
    : games;

  return (
    <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-6 shadow-sm">
      <div className="mb-6">
        <div className="flex overflow-x-auto pb-1 gap-2">
          {/* All filter tab */}
          <button
            onClick={() => setSelectedType("")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              selectedType === ""
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } transition-colors`}
          >
            All <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs">
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
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  type.id === selectedType
                    ? 'bg-black text-white'
                    : isDisabled
                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } transition-colors`}
                disabled={isDisabled}
              >
                {type.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  type.id === selectedType
                    ? 'bg-white/30 text-white'
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
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filteredGames.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredGames.map(game => (
            <div 
              key={game.id}
              className="rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group p-4 cursor-pointer"
              onClick={() => onGameClick(game.id)}
            >
              <div className="flex justify-between items-start gap-2">
                <p className="font-medium text-gray-700 group-hover:text-black transition-colors line-clamp-2">
                  {game.prompt}
                </p>
                
                {game.type && (
                  <span className={`text-xs px-2 py-1 rounded-full ${getTypeInfo(game.type).badgeColor} ml-2 whitespace-nowrap flex-shrink-0`}>
                    {getTypeInfo(game.type).label.split(' ')[0]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">
          {selectedType 
            ? `No ${contentTypes.find(t => t.id === selectedType)?.label || selectedType} projects found.` 
            : "No games have been created yet. Be the first to create one!"}
        </p>
      )}
    </div>
  );
}
