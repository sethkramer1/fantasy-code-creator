
import { Game } from "@/types/game";
import { Loader2, ArrowUpRight } from "lucide-react";
import { getTypeInfo, prepareIframeContent } from "./utils/gamesListUtils";
import { useEffect, useState } from "react";

interface GameCardProps {
  game: Game;
  gameCode: string | undefined;
  onClick: () => void;
}

export function GameCard({ game, gameCode, onClick }: GameCardProps) {
  const { label, badgeColor } = getTypeInfo(game.type);
  const [iframeKey, setIframeKey] = useState<number>(0);
  
  // Reset iframe when gameCode changes to force reload
  useEffect(() => {
    if (gameCode) {
      setIframeKey(prev => prev + 1);
    }
  }, [gameCode]);
  
  return (
    <div 
      className="rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group overflow-hidden cursor-pointer hover-scale card-shadow"
      onClick={onClick}
    >
      {/* Preview iframe */}
      <div className="relative w-full h-40 bg-gray-50 border-b border-gray-100 overflow-hidden">
        {gameCode ? (
          <iframe 
            key={iframeKey}
            srcDoc={prepareIframeContent(gameCode)}
            className="pointer-events-none"
            style={{ 
              width: '400%',  /* Make iframe 4x wider to match the 0.25 scale */
              height: '800px',
              transform: 'scale(0.25)', 
              transformOrigin: 'top left',
              border: 'none',
              overflow: 'hidden'
            }}
            title={`Preview of ${game.prompt || 'design'}`}
            loading="lazy"
            sandbox="allow-same-origin allow-scripts"
          />
        ) : (
          <div className="flex items-center justify-center h-full w-full">
            <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 z-10" aria-hidden="true"></div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-2 flex-1">
            <p className="font-medium text-gray-900 group-hover:text-black transition-colors line-clamp-2">
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
          
          <div className="p-1.5 rounded-full bg-gray-50 group-hover:bg-gray-100 transition-colors">
            <ArrowUpRight size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}
