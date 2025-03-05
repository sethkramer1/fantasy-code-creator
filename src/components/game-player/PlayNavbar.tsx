import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GameActions } from "./GameActions";
import { useAuth } from "@/context/AuthContext";
import { Download, UserCircle, Globe, Lock, ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    <nav className="border-b bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo and back button */}
            <Button
              variant="ghost"
              className="mr-2"
              onClick={handleBackClick}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="flex items-center border-l pl-4 ml-2">
              <h1 className="text-lg font-medium text-gray-800 truncate max-w-[200px] sm:max-w-md">
                {gameName || "Untitled Design"}
              </h1>
            </div>
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
              className="h-8 gap-1 text-sm border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300" 
              onClick={onDownload}
            >
              <Download size={14} />
              ZIP
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full h-10 w-10 p-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || "User"} />
                      <AvatarFallback>
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.user_metadata?.full_name || "User"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleAccountClick}>
                    <UserCircle size={16} className="mr-2" />
                    Account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={handleLoginClick}
                size="sm" 
                variant="default"
                className="h-9"
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
