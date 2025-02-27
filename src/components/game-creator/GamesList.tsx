
import { Game } from "@/types/game";
import { Loader2 } from "lucide-react";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (gameId: string) => void;
}

export function GamesList({ games, isLoading, onGameClick }: GamesListProps) {
  return (
    <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-medium text-gray-900 mb-6">Available Games</h2>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : games.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => onGameClick(game.id)}
              className="p-4 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group"
            >
              <p className="font-medium text-gray-700 group-hover:text-black transition-colors line-clamp-2">
                {game.prompt}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {new Date(game.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">
          No games have been created yet. Be the first to create one!
        </p>
      )}
    </div>
  );
}
