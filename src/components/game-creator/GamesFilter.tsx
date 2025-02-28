
import { Game, contentTypes } from "@/types/game";
import { Search } from "lucide-react";

interface GamesFilterProps {
  games: Game[];
  selectedType: string;
  setSelectedType: (type: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function GamesFilter({
  games,
  selectedType,
  setSelectedType,
  searchQuery,
  setSearchQuery
}: GamesFilterProps) {
  // Calculate counts for each content type
  const typeCounts = games.reduce((counts: Record<string, number>, game) => {
    if (game.type) {
      counts[game.type] = (counts[game.type] || 0) + 1;
    }
    return counts;
  }, {});

  return (
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
              ? 'bg-black text-white shadow-sm'
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
                  ? 'bg-black text-white shadow-sm'
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
  );
}
