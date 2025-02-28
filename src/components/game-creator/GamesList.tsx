
import { useState, useEffect } from "react";
import { Game, contentTypes } from "@/types/game";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { GameTypeSelector } from "@/components/game-creator/GameTypeSelector";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (gameId: string) => void;
}

interface GamePreviewProps {
  gameId: string;
}

// Component to handle the lazy-loading of game code for the iframe
function GamePreview({ gameId }: GamePreviewProps) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameCode = async () => {
      try {
        // Get the latest version of the game
        const { data, error } = await supabase
          .from('games')
          .select(`
            current_version,
            game_versions (
              code
            )
          `)
          .eq('id', gameId)
          .single();

        if (error) throw error;
        
        // Find the latest version's code
        if (data && data.game_versions && data.game_versions.length > 0) {
          // Get the latest version
          const latestVersion = data.game_versions.find(
            (v: any) => v.version_number === data.current_version
          ) || data.game_versions[0];
          
          setCode(latestVersion.code);
        } else {
          setError("No code found for this game");
        }
      } catch (err) {
        console.error("Error fetching game code:", err);
        setError("Failed to load preview");
      } finally {
        setLoading(false);
      }
    };

    fetchGameCode();
  }, [gameId]);

  // Helper function to sanitize HTML for iframe
  const prepareIframeContent = (html: string) => {
    // Add a base tag to handle relative paths
    const baseTag = `<base target="_blank">`;

    // Add styles to make iframe content fit small container
    const styleTag = `
      <style>
        html, body { 
          margin: 0; 
          padding: 0; 
          height: 100%; 
          overflow: hidden;
          transform: scale(0.5);
          transform-origin: 0 0;
          width: 200%;
          height: 200%;
        }
      </style>
    `;

    // Check if there's a head tag and insert our code
    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>${baseTag}${styleTag}`);
    } else if (html.includes('<html')) {
      return html.replace(/<html[^>]*>/, `$&<head>${baseTag}${styleTag}</head>`);
    } else {
      return `<html><head>${baseTag}${styleTag}</head><body>${html}</body></html>`;
    }
  };

  if (loading) {
    return (
      <div className="aspect-video bg-gray-50 flex items-center justify-center rounded-md overflow-hidden">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-gray-50 flex items-center justify-center rounded-md overflow-hidden">
        <p className="text-xs text-gray-400">{error}</p>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="aspect-video bg-gray-50 flex items-center justify-center rounded-md overflow-hidden">
        <p className="text-xs text-gray-400">No preview available</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-white border border-gray-100 rounded-md overflow-hidden">
      <iframe 
        srcDoc={prepareIframeContent(code)}
        className="w-full h-full"
        sandbox="allow-scripts"
        title={`Preview for game ${gameId}`}
      />
    </div>
  );
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
  
  // Filter games based on selected type
  const filteredGames = selectedType 
    ? games.filter(game => game.type === selectedType)
    : games;

  return (
    <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <h2 className="text-xl font-medium text-gray-900">My History</h2>
        
        {/* Type filter */}
        <div className="w-full md:w-auto">
          <GameTypeSelector 
            selectedType={selectedType} 
            onSelect={setSelectedType} 
          />
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filteredGames.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredGames.map(game => (
            <button 
              key={game.id}
              onClick={() => onGameClick(game.id)}
              className="rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group overflow-hidden flex flex-col w-full"
            >
              {/* Preview iframe */}
              <div className="overflow-hidden flex-shrink-0">
                <GamePreview gameId={game.id} />
              </div>
              
              {/* Game info */}
              <div className="p-4 text-left flex-1 flex flex-col">
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
                
                <p className="text-sm text-gray-400 mt-2 flex-shrink-0">
                  {new Date(game.created_at).toLocaleDateString()}
                </p>
              </div>
            </button>
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
