
import { Game } from "@/types/game";
import { Loader2, ArrowUpRight, Trash2 } from "lucide-react";
import { getTypeInfo, prepareIframeContent } from "./utils/gamesListUtils";
import { useEffect, useState, MouseEvent } from "react";
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
}

export function GameCard({ game, gameCode, onClick, onDelete }: GameCardProps) {
  const { label, badgeColor } = getTypeInfo(game.type);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user, isAdmin } = useAuth();
  
  // SIMPLIFIED: Admin can delete ANY game, normal users can only delete their own
  const canDelete = !!onDelete && (
    isAdmin || 
    (user?.id && game.user_id === user.id)
  );
  
  console.log(`GameCard ${game.id}: admin=${isAdmin}, canDelete=${canDelete}, user=${user?.id}, userEmail=${user?.email}, gameOwner=${game.user_id}`);
  
  // Reset iframe when gameCode changes to force reload
  useEffect(() => {
    if (gameCode) {
      setIframeKey(prev => prev + 1);
    }
  }, [gameCode]);
  
  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    console.log(`Delete button clicked for game ${game.id}, user is admin: ${isAdmin}, user email: ${user?.email}`);
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = async () => {
    if (!onDelete) {
      console.error("No onDelete function provided");
      return;
    }
    
    console.log(`Confirming delete for game ${game.id}, by admin: ${isAdmin}, user: ${user?.email}`);
    setIsDeleting(true);
    const success = await onDelete(game.id);
    
    console.log(`Delete operation result for ${game.id}: ${success ? 'SUCCESS' : 'FAILED'}`);
    
    if (!success) {
      setIsDeleting(false);
    }
    setShowDeleteDialog(false);
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
                  <span className={`text-xs px-2.5 py-1 ${badgeColor} whitespace-nowrap flex-shrink-0 font-medium`}>
                    {label.split(' ')[0]}
                  </span>
                )}
                {isAdmin && !game.user_id && (
                  <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0 font-medium">
                    Anonymous
                  </span>
                )}
                {isAdmin && game.user_id && game.user_id !== user?.id && (
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
        
        {/* Always show delete button for admins and owners */}
        {canDelete && (
          <div 
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 hover:bg-red-50 transition-colors shadow-sm z-20"
            onClick={handleDelete}
          >
            <Trash2 size={16} className="text-gray-400 hover:text-red-500 transition-colors" />
          </div>
        )}
      </div>
      
      {/* Delete confirmation dialog */}
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
