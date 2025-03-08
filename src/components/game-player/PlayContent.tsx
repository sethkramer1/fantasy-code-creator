
import React, { useEffect, useRef, useState } from 'react';
import { GamePreview } from './GamePreview';
import { SidebarChat } from './SidebarChat';
import { Terminal } from './Terminal';
import { GameVersion } from '@/types/game';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useAuth } from '@/context/AuthContext';
import { Message } from '@/components/game-chat/types';

interface PlayContentProps {
  gameId: string;
  initialCode: string;
  initialInstructions: string;
  initialPrompt: string;
  userId?: string;
  generationInProgress: boolean;
  onCodeUpdate: (code: string) => void;
  currentVersion: GameVersion;
  gameVersions: GameVersion[];
  showCode: boolean;
  modelType?: string;
  isCreator?: boolean;
}

export function PlayContent({
  gameId,
  initialCode,
  initialInstructions,
  initialPrompt,
  userId,
  generationInProgress,
  onCodeUpdate,
  currentVersion,
  gameVersions,
  showCode,
  modelType = 'smart',
  isCreator = true
}: PlayContentProps) {
  const [code, setCode] = useState(initialCode);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [thinkingProgress, setThinkingProgress] = useState(0);
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    setCode(currentVersion.code);
    setInstructions(currentVersion.instructions || '');
  }, [currentVersion]);

  // Handle game updates coming from chat
  const handleGameUpdate = (newCode: string, newInstructions: string) => {
    setCode(newCode);
    setInstructions(newInstructions);
    onCodeUpdate(newCode);
  };

  // Handle terminal status changes 
  const handleTerminalStatusChange = (
    showing: boolean,
    output: string[],
    thinking: number,
    isLoading: boolean
  ) => {
    setShowTerminal(showing);
    setTerminalOutput(output);
    setThinkingProgress(thinking);
    setIsTerminalLoading(isLoading);
  };

  // Handle reverting to a previous version from a message
  const handleRevertToMessageVersion = async (message: Message) => {
    // Find the game version that corresponds to this message
    const versionId = message.version_id;
    if (!versionId) return;

    // Find the version in our gameVersions array
    const versionToRevert = gameVersions.find(v => v.id === versionId);
    if (!versionToRevert) return;

    // Update our state
    setCode(versionToRevert.code);
    setInstructions(versionToRevert.instructions || '');
    onCodeUpdate(versionToRevert.code);
  };

  // Determine if current user is the owner of the game
  const isOwner = userId && user?.id === userId;

  return (
    <div className="flex h-full">
      {/* Left panel - chat */}
      <SidebarChat
        gameId={gameId}
        generationInProgress={generationInProgress}
        onGameUpdate={handleGameUpdate}
        onTerminalStatusChange={handleTerminalStatusChange}
        onRevertToMessageVersion={handleRevertToMessageVersion}
        gameVersions={gameVersions}
        initialPrompt={initialPrompt}
        modelType={modelType as any}
        isCreator={isCreator}
      />

      {/* Right panel - code preview and terminal */}
      <div className="flex-1 flex flex-col h-full">
        {/* Game preview */}
        <div className="flex-1 overflow-hidden">
          <GamePreview
            currentVersion={currentVersion}
            showCode={showCode}
            ref={iframeRef}
            isOwner={isOwner}
          />
        </div>

        {/* Terminal */}
        {showTerminal && (
          <Terminal
            output={terminalOutput}
            thinkingProgress={thinkingProgress}
            isLoading={isTerminalLoading}
          />
        )}
      </div>
    </div>
  );
}
