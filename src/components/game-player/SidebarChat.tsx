
import { GameChat } from "@/components/GameChat";
import { Message } from "@/components/game-chat/types";
import { ModelType } from "@/types/generation";

interface SidebarChatProps {
  gameId: string;
  generationInProgress: boolean;
  onGameUpdate: (newCode: string, newInstructions: string) => Promise<void>;
  onTerminalStatusChange: (showing: boolean, output: string[], thinking: number, isLoading: boolean) => void;
  onRevertToMessageVersion: (message: Message) => Promise<void>;
  gameVersions: any[];
  initialPrompt: string;
  modelType?: ModelType;
  gameUserId?: string | null;
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
  gameUserId
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
          modelType={modelType}
          gameUserId={gameUserId}
        />
      </div>
    </div>
  );
}
