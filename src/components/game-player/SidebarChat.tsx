
import { GameChat } from "@/components/GameChat";
import { Message } from "@/components/game-chat/types";

interface SidebarChatProps {
  gameId: string;
  generationInProgress: boolean;
  onGameUpdate: (newCode: string, newInstructions: string) => void;
  onTerminalStatusChange: (showing: boolean, output: string[], thinking: number, isLoading: boolean) => void;
  onRevertToMessageVersion: (message: Message) => Promise<void>;
  gameVersions: any[];
  initialPrompt: string;
}

export function SidebarChat({
  gameId,
  generationInProgress,
  onGameUpdate,
  onTerminalStatusChange,
  onRevertToMessageVersion,
  gameVersions,
  initialPrompt
}: SidebarChatProps) {
  return (
    <div className="w-[380px] flex flex-col bg-white border-r border-gray-100">
      <div className="flex-1 overflow-hidden">
        <GameChat 
          gameId={gameId} 
          onGameUpdate={onGameUpdate} 
          onTerminalStatusChange={onTerminalStatusChange}
          disabled={generationInProgress}
          onRevertToVersion={onRevertToMessageVersion}
          gameVersions={gameVersions}
          initialMessage={initialPrompt}
        />
      </div>
    </div>
  );
}
