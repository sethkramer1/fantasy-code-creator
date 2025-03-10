import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GameActions } from "./GameActions";
import { useAuth } from "@/context/AuthContext";
import { Download, UserCircle, ArrowLeft, Globe, Lock, Link2, Pencil, Check, X, GitFork } from "lucide-react";
import { ShareButton } from "./ShareButton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GameVersion } from "./hooks/useGameVersions";

interface PlayNavbarProps {
  gameId: string;
  gameName: string;
  gameUserId?: string | null;
  visibility?: string;
  onVisibilityChange?: (visibility: string) => Promise<void>;
  onNameChange?: (name: string) => Promise<void>;
  onExport?: () => void;
  onDownload?: () => void;
  onFork?: () => void;
  onShare?: () => void;
  isForkingInProgress?: boolean;
  showCodeEditor: boolean;
  onShowCodeEditorChange: (show: boolean) => void;
  currentVersion?: GameVersion;
}

export function PlayNavbar({
  gameId,
  gameName,
  gameUserId,
  visibility = 'public',
  onVisibilityChange,
  onNameChange,
  onExport,
  onDownload,
  onFork,
  onShare,
  isForkingInProgress = false,
  showCodeEditor,
  onShowCodeEditorChange,
  currentVersion,
}: PlayNavbarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(gameName);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Update nameValue when gameName changes
  useEffect(() => {
    setNameValue(gameName);
  }, [gameName]);
  
  // Focus the input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);
  
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
  
  const handleStartEditing = () => {
    if (isOwner) {
      setIsEditingName(true);
    }
  };
  
  const handleSaveName = async () => {
    if (onNameChange && nameValue.trim() !== gameName) {
      await onNameChange(nameValue.trim());
    }
    setIsEditingName(false);
  };
  
  const handleCancelEditing = () => {
    setNameValue(gameName);
    setIsEditingName(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEditing();
    }
  };
  
  // Get visibility badge info
  const getVisibilityBadge = () => {
    switch (visibility) {
      case 'public':
        return {
          label: 'Public',
          icon: <Globe size={12} className="mr-1" />,
          variant: 'success' as const
        };
      case 'unlisted':
        return {
          label: 'Unlisted',
          icon: <Link2 size={12} className="mr-1" />,
          variant: 'secondary' as const
        };
      case 'private':
      default:
        return {
          label: 'Private',
          icon: <Lock size={12} className="mr-1" />,
          variant: 'outline' as const
        };
    }
  };
  
  const visibilityBadge = getVisibilityBadge();

  return (
    <nav className="border-b border-gray-100 bg-white shadow-sm sticky top-0 z-50 h-16 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between h-full">
          <div className="flex items-center">
            {/* Logo and back button */}
            <Button
              variant="ghost"
              className="mr-2 rounded-full transition-all hover:bg-gray-100"
              onClick={handleBackClick}
            >
              <ArrowLeft className="h-4 w-4 mr-2 text-gray-700" />
              <span className="text-gray-700 font-medium">Back</span>
            </Button>
            
            <div className="flex items-center border-l border-gray-200 pl-4 ml-3">
              {isEditingName ? (
                <div className="flex items-center">
                  <Input
                    ref={nameInputRef}
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-9 w-[200px] sm:w-[300px] text-base font-medium border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Enter design name"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 ml-1 hover:bg-green-50 rounded-full" 
                    onClick={handleSaveName}
                  >
                    <Check className="h-5 w-5 text-green-600" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-red-50 rounded-full" 
                    onClick={handleCancelEditing}
                  >
                    <X className="h-5 w-5 text-red-600" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center group">
                  <h1 className="text-lg font-semibold text-gray-800 truncate max-w-[200px] sm:max-w-md group-hover:text-blue-600 transition-colors">
                    {gameName || "Untitled Design"}
                  </h1>
                  {isOwner && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 rounded-full" 
                      onClick={handleStartEditing}
                    >
                      <Pencil className="h-3.5 w-3.5 text-blue-500" />
                    </Button>
                  )}
                </div>
              )}
              
              {/* Visibility badge */}
              <Badge 
                variant={visibilityBadge.variant} 
                className="ml-3 flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
              >
                {visibilityBadge.icon}
                {visibilityBadge.label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Share button for owners only */}
            {isOwner && onVisibilityChange && (
              <ShareButton 
                visibility={visibility}
                onVisibilityChange={onVisibilityChange}
                gameId={gameId}
                isOwner={isOwner}
              />
            )}
            
            {/* Download button - only shown to owner */}
            {isOwner && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-1.5 text-sm border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 font-medium rounded-full px-4" 
                onClick={onDownload}
              >
                <Download size={15} />
                <span>Download</span>
              </Button>
            )}
            
            {onFork && (
              <Button 
                variant="default" 
                size="sm"
                onClick={onFork}
                disabled={isForkingInProgress}
                className="h-9 gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-full px-4"
              >
                <GitFork size={15} />
                <span>{isForkingInProgress ? "Remixing..." : "Remix"}</span>
              </Button>
            )}
            
            <GameActions
              currentVersion={currentVersion}
              showGenerating={false}
              isLatestVersion={true}
              onRevertToVersion={() => Promise.resolve()}
              onExport={onExport}
              onDownload={onDownload}
              onFork={onFork}
              onShare={onShare}
              showCodeEditor={showCodeEditor}
              onShowCodeEditorChange={onShowCodeEditorChange}
              gameUserId={gameUserId}
              isForkingInProgress={isForkingInProgress}
            />
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full h-10 w-10 p-0 hover:bg-gray-100">
                    <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                      <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || "User"} />
                      <AvatarFallback className="bg-blue-100 text-blue-800 font-medium">
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 shadow-lg border-gray-200">
                  <DropdownMenuLabel className="font-normal px-3 py-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.user_metadata?.full_name || "User"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-100" />
                  <DropdownMenuItem 
                    onClick={handleAccountClick}
                    className="rounded-lg hover:bg-blue-50 cursor-pointer transition-colors px-3 py-2 mx-1 my-1"
                  >
                    <UserCircle size={16} className="mr-2 text-blue-600" />
                    <span className="text-gray-800">Account</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={handleLoginClick}
                size="sm" 
                variant="default"
                className="h-9 rounded-full px-4 bg-blue-600 hover:bg-blue-700"
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
