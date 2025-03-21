
import { useRef, useEffect } from "react";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { ViewToggle } from "@/components/game-player/ViewToggle";
import { VersionSelector } from "@/components/game-player/VersionSelector";
import { GamePreview } from "@/components/game-player/GamePreview";
import { GameVersion } from "./hooks/useGameVersions";

interface PlayContentProps {
  showGenerating: boolean;
  gameVersions: GameVersion[];
  selectedVersion: string;
  onVersionChange: (versionId: string) => void;
  onRevertToVersion: (version: GameVersion) => Promise<void>;
  showCode: boolean;
  setShowCode: (show: boolean) => void;
  terminalOutput: string[];
  thinkingTime: number;
  generationInProgress: boolean;
  isLatestVersion: boolean;
  currentVersion?: GameVersion;
  isOwner?: boolean;
  onSaveCode?: (updatedVersion: GameVersion) => void;
}

export function PlayContent({
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
  isOwner = false,
  onSaveCode
}: PlayContentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Log state changes for debugging
  useEffect(() => {
    console.log("PlayContent state:", { 
      showGenerating, 
      generationInProgress, 
      hasCurrentVersion: !!currentVersion,
      versionId: currentVersion?.id,
      isOwner
    });
  }, [showGenerating, generationInProgress, currentVersion, isOwner]);

  // Ensure the iframe gets focus when it becomes visible
  useEffect(() => {
    if (!showGenerating && currentVersion && iframeRef.current) {
      console.log("Generation view hidden, focusing iframe");
      // Use a slightly longer timeout to ensure everything is ready
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.focus();
        }
      }, 250);
    }
  }, [showGenerating, currentVersion]);

  // This effect handles the transition from generation to preview
  useEffect(() => {
    if (!showGenerating && !generationInProgress && currentVersion) {
      console.log("Generation complete, focusing iframe");
      // Ensure DOM is updated before focusing
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.focus();
        }
      }, 250);
    }
  }, [showGenerating, generationInProgress, currentVersion]);

  return (
    <div className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden mt-0">
      <div className="max-w-[1200px] mx-auto w-full flex-1 flex flex-col">
        <div className="bg-gradient-to-b from-gray-50/80 to-white/95 border border-gray-200 rounded-2xl p-4 md:p-6 flex-1 flex flex-col overflow-hidden shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4 md:mb-5 flex-shrink-0 px-1">
            <div className="flex items-center gap-4">
              {!showGenerating && (
                <ViewToggle showCode={showCode} onToggle={setShowCode} />
              )}
            </div>
            
            {!showGenerating && gameVersions.length > 0 && (
              <VersionSelector 
                gameVersions={gameVersions}
                selectedVersion={selectedVersion}
                onVersionChange={onVersionChange}
                onRevertToVersion={onRevertToVersion}
                isLatestVersion={isLatestVersion}
              />
            )}
          </div>

          <div className="flex-1 bg-white backdrop-blur-sm rounded-xl overflow-hidden shadow-md border border-gray-100">
            {showGenerating ? (
              <GenerationTerminal
                open={true}
                onOpenChange={() => {}}
                output={terminalOutput}
                thinkingTime={thinkingTime}
                loading={generationInProgress}
                asModal={false}
              />
            ) : (
              <GamePreview 
                currentVersion={currentVersion} 
                showCode={showCode} 
                ref={iframeRef}
                isOwner={isOwner}
                onSaveCode={onSaveCode}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
