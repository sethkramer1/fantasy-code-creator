
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GameActions } from "./GameActions";
import { useAuth } from "@/context/AuthContext";
import { Download, UserCircle, Globe, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PlayNavbarProps {
  gameId: string;
  gameName: string;
  gameUserId?: string | null;
  visibility?: string;
  onVisibilityChange?: (visibility: string) => Promise<void>;
  onExport?: () => void;
  onDownload?: () => void;
  onFork?: () => void;
  onShare?: () => void;
  showCodeEditor: boolean;
  onShowCodeEditorChange: (show: boolean) => void;
}

export function PlayNavbar({
  gameId,
  gameName,
  gameUserId,
  visibility = 'public',
  onVisibilityChange,
  onExport,
  onDownload,
  onFork,
  onShare,
  showCodeEditor,
  onShowCodeEditorChange,
}: PlayNavbarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPublic, setIsPublic] = useState(visibility === 'public');
  const [changingVisibility, setChangingVisibility] = useState(false);
  
  // Check if current user is the owner of the game
  const isOwner = user?.id && gameUserId === user.id;

  const handleBackClick = () => {
    navigate("/");
  };

  const handleLoginClick = () => {
    navigate("/auth");
  };

  const handleAccountClick = () => {
    navigate("/account");
  };
  
  const handleVisibilityChange = async (checked: boolean) => {
    if (!isOwner || !gameId || !onVisibilityChange) return;
    
    setChangingVisibility(true);
    const newVisibility = checked ? 'public' : 'private';
    
    try {
      // Update visibility in database
      await onVisibilityChange(newVisibility);
      setIsPublic(checked);
      
      toast({
        title: `Design is now ${checked ? 'public' : 'private'}`,
        description: checked 
          ? "Your design is visible to everyone" 
          : "Your design is only visible to you",
      });
    } catch (error) {
      console.error("Error changing visibility:", error);
      toast({
        title: "Error changing visibility",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setChangingVisibility(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 py-2 px-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center">
        <Button
          onClick={handleBackClick}
          variant="ghost"
          size="sm"
          className="mr-4 text-gray-700 hover:bg-gray-100"
        >
          ← Back
        </Button>
        <h1 className="text-lg font-medium text-gray-800 truncate max-w-[200px] sm:max-w-md">
          {gameName || "Untitled Design"}
        </h1>
      </div>

      <div className="flex items-center space-x-2">
        {/* Visibility toggle for owners only */}
        {isOwner && (
          <div className="flex items-center mr-3 space-x-2 border-r border-gray-200 pr-3">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Globe size={16} className="text-green-600" />
              ) : (
                <Lock size={16} className="text-gray-600" />
              )}
              <Label htmlFor="visibility-toggle" className="text-sm">
                {isPublic ? "Public" : "Private"}
              </Label>
            </div>
            <Switch
              id="visibility-toggle"
              checked={isPublic}
              onCheckedChange={handleVisibilityChange}
              disabled={changingVisibility || !isOwner}
            />
          </div>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-1 text-sm border-gray-200 text-gray-700 hover:bg-gray-100" 
          onClick={onDownload}
        >
          <Download size={14} />
          Download Zip
        </Button>
        
        <GameActions
          currentVersion={undefined}
          showGenerating={false}
          isLatestVersion={true}
          onRevertToVersion={() => Promise.resolve()}
          onExport={onExport}
          onDownload={onDownload}
          onFork={onFork}
          onShare={onShare}
          showCodeEditor={showCodeEditor}
          onShowCodeEditorChange={onShowCodeEditorChange}
        />
        
        {user ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2 ml-2 border-gray-200 text-gray-700 hover:bg-gray-100"
            onClick={handleAccountClick}
          >
            <UserCircle size={16} />
            <span className="hidden sm:inline">Account</span>
          </Button>
        ) : (
          <Button 
            onClick={handleLoginClick}
            size="sm" 
            variant="outline"
            className="ml-2 border-gray-200 text-gray-700 hover:bg-gray-100"
          >
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
