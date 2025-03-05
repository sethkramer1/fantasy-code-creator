import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Globe, Lock, Link2, Check, Copy, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  visibility: string;
  onVisibilityChange: (visibility: string) => Promise<void>;
  gameId: string;
  isOwner: boolean;
}

export function ShareButton({
  visibility,
  onVisibilityChange,
  gameId,
  isOwner,
}: ShareButtonProps) {
  const { toast } = useToast();
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleVisibilityChange = async (newVisibility: string) => {
    if (!isOwner || !gameId) return;
    
    setChangingVisibility(true);
    
    try {
      await onVisibilityChange(newVisibility);
      
      const visibilityLabels = {
        'public': 'Public - Anyone can view',
        'private': 'Private - Only you can view',
        'unlisted': 'Unlisted - Anyone with the link can view'
      };
      
      toast({
        title: `Visibility changed`,
        description: visibilityLabels[newVisibility as keyof typeof visibilityLabels],
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
  
  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set copied state to true
      setCopied(true);
      
      // Reset after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
      
      toast({
        title: "Link copied",
        description: "Share link has been copied to clipboard",
      });
    }).catch(err => {
      console.error("Failed to copy link:", err);
      toast({
        title: "Failed to copy link",
        description: "Please try again",
        variant: "destructive"
      });
    });
  };
  
  // Get the appropriate icon based on visibility
  const getVisibilityIcon = () => {
    switch (visibility) {
      case 'public':
        return <Globe size={14} className="text-green-600" />;
      case 'unlisted':
        return <Link2 size={14} className="text-blue-600" />;
      case 'private':
      default:
        return <Lock size={14} className="text-gray-600" />;
    }
  };
  
  const handleCloseDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
  };
  
  // Only show the share button to owners
  if (!isOwner) return null;
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-1 text-sm border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300"
          disabled={changingVisibility}
        >
          {getVisibilityIcon()}
          <span>Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" onEscapeKeyDown={() => setIsOpen(false)}>
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Share Settings</DropdownMenuLabel>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 rounded-full" 
            onClick={handleCloseDropdown}
          >
            <X size={14} />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className={cn(
            "flex items-center gap-2 cursor-pointer transition-colors",
            "hover:bg-green-50",
            visibility === 'public' ? 'bg-green-50' : ''
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleVisibilityChange('public');
          }}
          onSelect={(e) => e.preventDefault()}
        >
          <Globe size={16} className="text-green-600 flex-shrink-0" />
          <div className="flex flex-col">
            <span>Public</span>
            <span className="text-xs text-gray-500">Anyone can view</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className={cn(
            "flex items-center gap-2 cursor-pointer transition-colors",
            "hover:bg-gray-100",
            visibility === 'private' ? 'bg-gray-100' : ''
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleVisibilityChange('private');
          }}
          onSelect={(e) => e.preventDefault()}
        >
          <Lock size={16} className="text-gray-600 flex-shrink-0" />
          <div className="flex flex-col">
            <span>Private</span>
            <span className="text-xs text-gray-500">Only you can view</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className={cn(
            "flex items-center gap-2 cursor-pointer transition-colors",
            "hover:bg-blue-50",
            visibility === 'unlisted' ? 'bg-blue-50' : ''
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleVisibilityChange('unlisted');
          }}
          onSelect={(e) => e.preventDefault()}
        >
          <Link2 size={16} className="text-blue-600 flex-shrink-0" />
          <div className="flex flex-col">
            <span>Unlisted</span>
            <span className="text-xs text-gray-500">Anyone with the link can view</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="flex items-center justify-between cursor-pointer hover:bg-gray-100"
          onClick={handleCopyLink}
          onSelect={(e) => e.preventDefault()}
        >
          <span>Copy link</span>
          {copied ? (
            <Check size={16} className="text-green-600" />
          ) : (
            <Copy size={16} className="text-gray-500" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 