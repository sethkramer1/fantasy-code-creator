
import { Game } from "@/types/game";
import { Loader2, Code } from "lucide-react";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (gameId: string) => void;
}

// Helper function to get a representative color for the game
const getColorForCode = (code: string | undefined): string => {
  if (!code) return "bg-gray-100";
  
  // Get dominant colors based on common patterns
  if (code.includes('bg-blue') || code.includes('color: blue') || code.includes('#0000') || code.includes('rgb(0, 0, 2')) {
    return "bg-blue-50 border-blue-200";
  } else if (code.includes('bg-green') || code.includes('color: green') || code.includes('#00') || code.includes('rgb(0, 2')) {
    return "bg-green-50 border-green-200";
  } else if (code.includes('bg-red') || code.includes('color: red') || code.includes('#f00') || code.includes('rgb(2')) {
    return "bg-red-50 border-red-200";
  } else if (code.includes('bg-purple') || code.includes('color: purple') || code.includes('#800080')) {
    return "bg-purple-50 border-purple-200";
  } else if (code.includes('bg-yellow') || code.includes('color: yellow') || code.includes('#ff0') || code.includes('rgb(255, 255, 0)')) {
    return "bg-yellow-50 border-yellow-200";
  }
  
  return "bg-gray-50 border-gray-200";
};

// Extract a small snippet of meaningful HTML from the code
const getCodeSnippet = (code: string | undefined): string => {
  if (!code) return "";
  
  // Extract the body content or a div with class/id
  let bodyContent = code.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || "";
  if (!bodyContent) {
    // Try to find a meaningful div or section
    bodyContent = code.match(/<div[^>]*class="[^"]*main[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || 
                 code.match(/<section[^>]*>([\s\S]*?)<\/section>/i)?.[1] || 
                 code.match(/<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || 
                 "";
  }
  
  // Clean up the snippet
  return bodyContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")    // Remove styles
    .replace(/<[^>]+>/g, "")                                             // Remove all HTML tags
    .replace(/\s+/g, " ")                                                // Normalize whitespace
    .trim()
    .substring(0, 150) + (bodyContent.length > 150 ? "..." : "");        // Limit length
};

export function GamesList({
  games,
  isLoading,
  onGameClick
}: GamesListProps) {
  return <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-medium text-gray-900 mb-6">My History</h2>
      {isLoading ? <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div> : games.length > 0 ? <div className="grid gap-4 md:grid-cols-2">
          {games.map(game => (
            <button 
              key={game.id} 
              onClick={() => onGameClick(game.id)} 
              className="rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group overflow-hidden"
            >
              <div className="p-4">
                <p className="font-medium text-gray-700 group-hover:text-black transition-colors line-clamp-2">
                  {game.prompt}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(game.created_at).toLocaleDateString()}
                </p>
              </div>
              
              {game.code && (
                <div className="flex flex-col">
                  <div className={`px-4 py-3 border-t text-xs font-mono truncate text-gray-600 ${getColorForCode(game.code)}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Code size={14} className="text-gray-500" />
                      <span className="text-gray-500 font-medium">Preview</span>
                    </div>
                    <p className="line-clamp-2 text-xs opacity-80">{getCodeSnippet(game.code)}</p>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div> : <p className="text-center text-gray-500 py-8">
          No games have been created yet. Be the first to create one!
        </p>}
    </div>;
}
