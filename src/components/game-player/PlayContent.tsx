
import { useState } from "react";
import { GamePreview } from "./GamePreview";
import { VersionSelector } from "./VersionSelector";
import { Terminal } from "./Terminal";
import { ViewToggle } from "./ViewToggle";

interface PlayContentProps {
  showGenerating: boolean;
  gameVersions: any[];
  selectedVersion: string | null;
  onVersionChange: (versionId: string) => void;
  onRevertToVersion: (versionId: string) => Promise<void>;
  showCode: boolean;
  setShowCode: (show: boolean) => void;
  terminalOutput: string;
  thinkingTime: number;
  generationInProgress: boolean;
  isLatestVersion: boolean;
  currentVersion: any;
  onCodeUpdate?: (gameId: string, newCode: string) => void;
}

export const PlayContent = ({
  showGenerating,
  gameVersions,
  selectedVersion,
  onVersionChange,
  onRevertToVersion,
  showCode,
  setShowCode,
  terminalOutput,
  thinkingTime,
  generationInProgress,
  isLatestVersion,
  currentVersion,
  onCodeUpdate
}: PlayContentProps) => {
  const currentVersionObj = gameVersions.find(v => v.id === selectedVersion);

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full">
      <div className="px-2 py-1 border-b border-gray-200 flex justify-between items-center">
        <VersionSelector 
          gameVersions={gameVersions} 
          selectedVersion={selectedVersion}
          onVersionChange={onVersionChange}
          isLatestVersion={isLatestVersion}
          disabled={showGenerating || generationInProgress}
        />
        
        <ViewToggle showCode={showCode} setShowCode={setShowCode} />
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        {showGenerating ? (
          <Terminal 
            output={terminalOutput} 
            thinkingTime={thinkingTime} 
            generationInProgress={generationInProgress} 
          />
        ) : (
          <GamePreview 
            currentVersion={currentVersionObj} 
            showCode={showCode}
            onCodeUpdate={onCodeUpdate}
          />
        )}
      </div>
    </div>
  );
};
