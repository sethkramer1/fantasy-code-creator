
import { Game } from "@/types/game";
import { Loader2, ArrowUpRight } from "lucide-react";
import { getTypeInfo } from "./utils/gamesListUtils";
import { useEffect, useState, useRef } from "react";
import DOMPurify from "dompurify";

interface GameCardProps {
  game: Game;
  gameCode: string | undefined;
  onClick: () => void;
}

export function GameCard({ game, gameCode, onClick }: GameCardProps) {
  const { label, badgeColor } = getTypeInfo(game.type);
  const previewRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState<number>(0);
  
  // Reset preview when gameCode changes to force reload
  useEffect(() => {
    if (gameCode) {
      setKey(prev => prev + 1);
    }
  }, [gameCode]);
  
  useEffect(() => {
    if (gameCode && previewRef.current) {
      // Clear previous content
      previewRef.current.innerHTML = '';
      
      // Insert the new HTML content directly with scaling wrapper
      const wrapper = document.createElement('div');
      wrapper.style.transform = 'scale(0.25)';
      wrapper.style.transformOrigin = 'top left';
      wrapper.style.width = '400%';
      wrapper.style.height = '800px';
      wrapper.style.pointerEvents = 'none';
      wrapper.style.overflow = 'hidden';
      
      // Sanitize the HTML
      const sanitizedHtml = DOMPurify.sanitize(gameCode, {
        ADD_TAGS: ['script'],
        FORCE_BODY: true,
      });
      
      wrapper.innerHTML = sanitizedHtml;
      previewRef.current.appendChild(wrapper);
    }
  }, [gameCode, key]);
  
  return (
    <div 
      className="rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group overflow-hidden cursor-pointer hover-scale card-shadow"
      onClick={onClick}
    >
      {/* Preview container */}
      <div className="relative w-full h-40 bg-gray-50 border-b border-gray-100 overflow-hidden">
        {gameCode ? (
          <div 
            ref={previewRef}
            key={key}
            className="pointer-events-none"
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

