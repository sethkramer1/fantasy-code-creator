import { Game } from "@/types/game";
import { Loader2, ArrowUpRight, Trash2, Globe, Lock, Link2 } from "lucide-react";
import { getTypeInfo, prepareIframeContent } from "./utils/gamesListUtils";
import { useEffect, useState, MouseEvent, useRef, memo } from "react";
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

// Memoized iframe component to prevent unnecessary re-renders
const MemoizedIframe = memo(({ srcDoc, onLoad, onError, title, className }: { 
  srcDoc: string | null;
  onLoad: () => void;
  onError: () => void;
  title: string;
  className: string;
}) => {
  return (
    <iframe 
      srcDoc={srcDoc || undefined}
      className={`pointer-events-none ${className}`}
      style={{ 
        width: '400%',
        height: '800px',
        transform: 'scale(0.25)', 
        transformOrigin: 'top left',
        border: 'none',
        overflow: 'hidden'
      }}
      title={title}
      loading="lazy"
      sandbox="allow-same-origin allow-scripts"
      onLoad={onLoad}
      onError={onError}
    />
  );
});

MemoizedIframe.displayName = "MemoizedIframe";

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
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [preparedContent, setPreparedContent] = useState<string | null>(null);
  
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
  
  // Process the iframe content only when needed
  useEffect(() => {
    if (!gameCode) return;
    
    // Use a web worker or requestIdleCallback if available to move this off the main thread
    const prepareContent = () => {
      try {
        if (gameCode === "Generating..." || gameCode.length < 20) {
          setPreparedContent(`<html><body><div style="display:flex;justify-content:center;align-items:center;height:100%;color:#888;">Preview loading...</div></body></html>`);
          return;
        }
        
        const content = prepareIframeContent(gameCode);
        setPreparedContent(content);
        setIframeLoading(true);
        setIframeError(false);
        setIframeKey(prev => prev + 1);
      } catch (error) {
        console.error(`GameCard ${game.id}: Error preparing iframe content:`, error);
        setPreparedContent(`<html><body><p>Error loading preview</p></body></html>`);
        setIframeError(true);
        setIframeLoading(false);
      }
    };
    
    // Use requestIdleCallback if available to not block the main thread
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      // @ts-ignore - TypeScript doesn't have types for requestIdleCallback
      window.requestIdleCallback(prepareContent);
    } else {
      // Fallback to setTimeout with a small delay
      setTimeout(prepareContent, 0);
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
  };
  
  const handleIframeError = () => {
    setIframeLoading(false);
    setIframeError(true);
  };
  
  return (
    <>
      <div 
        className="bg-white rounded-xl transition-all text-left group overflow-hidden cursor-pointer hover:shadow-lg"
        onClick={onClick}
      >
        {/* Preview iframe */}
        <div className="relative w-full aspect-video bg-gray-50 overflow-hidden">
          {preparedContent ? (
            <MemoizedIframe
              key={iframeKey}
              srcDoc={preparedContent}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title={`Preview of ${game.prompt || 'design'}`}
              className="w-full h-full"
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
          
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-all duration-200" aria-hidden="true"></div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium text-gray-900 line-clamp-1 mb-1">
                {game.prompt || "Untitled Design"}
              </h3>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeColor}`}>
                  {label}
                </span>
                {showVisibility && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    {game.visibility === 'public' ? (
                      <Globe size={12} />
                    ) : game.visibility === 'unlisted' ? (
                      <Link2 size={12} />
                    ) : (
                      <Lock size={12} />
                    )}
                    {game.visibility === 'public' 
                      ? 'Public' 
                      : game.visibility === 'unlisted'
                      ? 'Unlisted'
                      : 'Private'}
                  </span>
                )}
              </div>
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
