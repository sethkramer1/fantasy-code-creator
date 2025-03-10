import { GameChat } from "@/components/GameChat";
import { Message } from "@/components/game-chat/types";
import { ModelType } from "@/types/generation";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SidebarChatProps {
  gameId: string;
  generationInProgress: boolean;
  onGameUpdate: (newCode: string, newInstructions: string) => void;
  onTerminalStatusChange: (showing: boolean, output: string[], thinking: number, isLoading: boolean) => void;
  onRevertToMessageVersion: (message: Message) => Promise<void>;
  gameVersions: any[];
  initialPrompt: string;
  modelType?: ModelType;
  isCreator?: boolean;
}

export function SidebarChat({
  gameId,
  generationInProgress,
  onGameUpdate,
  onTerminalStatusChange,
  onRevertToMessageVersion,
  gameVersions,
  initialPrompt,
  modelType = "smart",
  isCreator = true
}: SidebarChatProps) {
  const { user } = useAuth();
  const game = gameVersions.length > 0 ? { user_id: gameVersions[0]?.user_id } : null;
  const [hasTeamAccess, setHasTeamAccess] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(false);
  
  // Check if user is authenticated
  const isAuthenticated = !!user;
  const isOwner = isAuthenticated && game?.user_id === user.id;
  
  // Check if user has access to the game through team membership
  useEffect(() => {
    const checkTeamAccess = async () => {
      if (!isAuthenticated || isOwner || !gameId || !user) {
        // Skip check if user is not authenticated, is the owner, or gameId is missing
        return;
      }
      
      try {
        setCheckingAccess(true);
        
        // First, check if the game is public
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('visibility')
          .eq('id', gameId)
          .single();
          
        if (gameError) {
          console.error("Error checking game visibility:", gameError);
          return;
        }
        
        // If the game is public, everyone has access
        if (gameData?.visibility === 'public') {
          setHasTeamAccess(true);
          return;
        }
        
        // If the game is private, check team membership
        // This is a simplified check - in a real app, you would check if the game
        // belongs to a team and if the user is a member of that team
        // For now, we'll assume that if the user can view the game, they have access
        setHasTeamAccess(true);
        
      } catch (error) {
        console.error("Error checking team access:", error);
      } finally {
        setCheckingAccess(false);
      }
    };
    
    checkTeamAccess();
  }, [gameId, isAuthenticated, isOwner, user]);
  
  // Determine if the user has access to the game
  const hasAccess = isAuthenticated && (isOwner || hasTeamAccess);
  
  // Determine if chat should be disabled
  const chatDisabled = generationInProgress || !isAuthenticated || (!hasAccess && !checkingAccess) || !isCreator;
  
  // Custom message for different states
  let disabledMessage = "";
  if (generationInProgress) {
    disabledMessage = "Chat will be enabled after content generation is complete";
  } else if (!isAuthenticated) {
    disabledMessage = "Please sign in to use the chat feature";
  } else if (!isCreator) {
    disabledMessage = "Only the creator can use the chat feature";
  } else if (!hasAccess && !checkingAccess) {
    disabledMessage = "You don't have access to chat in this project";
  }

  return (
    <div className="w-[380px] flex flex-col bg-white border-r border-gray-100 shadow-sm">
      <div className="flex-1 overflow-hidden">
        <div className="h-full rounded-r-lg overflow-hidden">
          <GameChat 
            gameId={gameId} 
            onGameUpdate={onGameUpdate} 
            onTerminalStatusChange={onTerminalStatusChange}
            disabled={chatDisabled}
            disabledMessage={disabledMessage}
            onRevertToVersion={onRevertToMessageVersion}
            gameVersions={gameVersions}
            initialMessage={initialPrompt}
            modelType={modelType}
          />
        </div>
      </div>
    </div>
  );
}
