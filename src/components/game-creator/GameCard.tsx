import { Game } from "@/types/game";
import { Loader2, ArrowUpRight, Trash2, Globe, Lock } from "lucide-react";
import { getTypeInfo, prepareIframeContent } from "./utils/gamesListUtils";
import { useEffect, useState, MouseEvent, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GameCardProps {
  game: Game;
  gameCode: string | undefined;
  onClick: () => void;
  onDelete?: (gameId: string) => Promise<boolean>;
  showVisibility?: boolean;
}

export function GameCard({ game, gameCode, onClick, onDelete, showVisibility = false }: GameCardProps) {
  const { label, badgeColor } = getTypeInfo(game.type);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localAdminStatus, setLocalAdminStatus] = useState(false);
  const { user, isAdmin, checkIsAdmin } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  
  // Check admin status when the component mounts or when the user changes
  useEffect(() => {
    const updateAdminStatus = async () => {
      if (user) {
        const isUserAdmin = await checkIsAdmin();
        setLocalAdminStatus(isUserAdmin);
      } else {
        setLocalAdminStatus(false);
      }
    };
    
    updateAdminStatus();
  }, [user, checkIsAdmin]);
  
  // SIMPLIFIED: Admin can delete ANY game, normal users can only delete their own
  const canDelete = !!onDelete && (
    localAdminStatus || 
    (user?.id && game.user_id === user.id)
  );
  
  // Is the current user the owner of this game?
  const isOwner = user?.id && game.user_id === user.id;
  
  // Reset iframe when gameCode changes to force reload
  useEffect(() => {
    if (gameCode) {
      setIframeKey(prev => prev + 1);
      setIframeLoading(true);
      setIframeError(false);
      console.log(`GameCard ${game.id}: Updating iframe with new code, key=${iframeKey}`);
    }
  }, [gameCode, game.id]);
  
  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (user) {
      const isUserAdmin = await checkIsAdmin();
      setLocalAdminStatus(isUserAdmin);
    }
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = async () => {
    if (!onDelete) {
      return;
    }
    
    setIsDeleting(true);
    const success = await onDelete(game.id);
    
    if (!success) {
      setIsDeleting(false);
    }
    setShowDeleteDialog(false);
  };
  
  // Handle iframe load events
  const handleIframeLoad = () => {
    setIframeLoading(false);
    console.log(`GameCard ${game.id}: iframe loaded successfully`);
  };
  
  const handleIframeError = () => {
    setIframeLoading(false);
    setIframeError(true);
    console.error(`GameCard ${game.id}: iframe failed to load`);
  };
  
  // This function ensures the iframe content is properly prepared and sanitized
  const getSafeIframeContent = () => {
    if (!gameCode) return null;
    
    try {
      // Check if the gameCode is valid
      if (gameCode === "Generating..." || gameCode.length < 20) {
        return `<html><body><div style="display:flex;justify-content:center;align-items:center;height:100%;color:#888;">Preview loading...</div></body></html>`;
      }
      
      // Prepare the iframe content
      const content = prepareIframeContent(gameCode);
      console.log(`GameCard ${game.id}: Prepared iframe content of length ${content.length}`);
      return content;
    } catch (error) {
      console.error(`GameCard ${game.id}: Error preparing iframe content:`, error);
      return `<html><body><p>Error loading preview</p></body></html>`;
    }
  };
  
  return (
    <>
      <div 
        className="bg-white border border-gray-200 transition-all text-left group overflow-hidden cursor-pointer hover-scale card-shadow relative"
        onClick={onClick}
      >
        {/* Preview iframe */}
        <div className="relative w-full h-40 bg-gray-50 border-b border-gray-200 overflow-hidden">
          {gameCode ? (
            <iframe 
              key={iframeKey}
              ref={iframeRef}
              srcDoc={getSafeIframeContent()}
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
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          ) : (
            <div className="flex items-center justify-center h-full w-full">
              <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
            </div>
          )}
          
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-80">
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
              
              <div className="flex items-center gap-2 flex-wrap">
                {game.type && (
                  <span className={`text-xs px-2.5 py-1 ${badgeColor} whitespace-nowrap flex-shrink-0 font-medium`}>
                    {label.split(' ')[0]}
                  </span>
                )}
                
                {showVisibility && (
                  <span className={`text-xs px-2.5 py-1 flex items-center gap-1 whitespace-nowrap flex-shrink-0 font-medium ${
                    game.visibility === 'public' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {game.visibility === 'public' 
                      ? <><Globe size={12} /> Public</> 
                      : <><Lock size={12} /> Private</>}
                  </span>
                )}
                
                {localAdminStatus && !game.user_id && (
                  <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0 font-medium">
                    Anonymous
                  </span>
                )}
                {localAdminStatus && game.user_id && game.user_id !== user?.id && (
                  <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0 font-medium">
                    Other User
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-1.5 bg-gray-50 group-hover:bg-gray-100 transition-colors">
              <ArrowUpRight size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>
          </div>
        </div>
        
        {canDelete && (
          <div 
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 hover:bg-red-50 transition-colors shadow-sm z-20"
            onClick={handleDelete}
          >
            <Trash2 size={16} className="text-gray-400 hover:text-red-500 transition-colors" />
          </div>
        )}
      </div>
      
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Design</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this design? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end space-x-2 sm:space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Design"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
