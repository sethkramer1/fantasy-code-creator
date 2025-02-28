
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
        // Get all versions for this game
        const { data: versionsData, error: versionsError } = await supabase
          .from('game_versions')
          .select('code, version_number, created_at')
          .eq('game_id', gameId)
          .order('version_number', { ascending: false });
        
        if (versionsError) throw versionsError;
        
        if (versionsData && versionsData.length > 0) {
          // The first item will be the version with the highest version_number
          // due to our descending order
          console.log(`Latest version for game ${gameId}:`, versionsData[0]);
          setCode(versionsData[0].code);
        } else {
          // If no versions in game_versions table, try fetching from the games table
          const { data: gameData, error: gameError } = await supabase
            .from('games')
            .select('code')
            .eq('id', gameId)
            .single();
          
          if (gameError) throw gameError;
          
          if (gameData && gameData.code) {
            setCode(gameData.code);
          } else {
            setError("No code found for this game");
          }
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

    // Add styles to make iframe content fit container properly
    const styleTag = `
      <style>
        html, body { 
          margin: 0; 
          padding: 0; 
          height: 100%; 
          width: 100%;
          overflow: hidden;
        }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        body > * {
          max-width: 90%;
          max-height: 90%;
          transform: scale(0.85);
          transform-origin: center center;
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
        className="w-full h-full pointer-events-none"
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
      <div className="mb-6">
        <div className="flex overflow-x-auto pb-1 gap-2">
          {contentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id === selectedType ? "" : type.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                type.id === selectedType
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } transition-colors`}
            >
              {type.label}
            </button>
          ))}
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
              className="rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group overflow-hidden flex flex-col w-full cursor-pointer"
              onClick={() => onGameClick(game.id)}
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
