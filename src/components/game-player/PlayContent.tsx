
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
  currentVersion
}: PlayContentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Ensure the iframe gets focus and is visible
  useEffect(() => {
    if (iframeRef.current && currentVersion) {
      iframeRef.current.focus();
    }
  }, [currentVersion]);

  // This effect handles the transition from generation to preview
  useEffect(() => {
    if (!showGenerating && !generationInProgress && currentVersion) {
      console.log("Generation complete, focusing iframe");
      // Small timeout to ensure DOM is updated before focusing
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.focus();
        }
      }, 100);
    }
  }, [showGenerating, generationInProgress, currentVersion]);

  return (
    <div className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden">
      <div className="max-w-[1200px] mx-auto w-full flex-1 flex flex-col">
        <div className="glass-panel bg-white border border-gray-100 rounded-xl p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-4">
              {!showGenerating && (
                <ViewToggle showCode={showCode} setShowCode={setShowCode} />
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

          <div className="flex-1 bg-white rounded-lg overflow-hidden">
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
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
