
import { useEffect, forwardRef, useState } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { IframePreview } from "./components/IframePreview";

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

interface GamePreviewProps {
  currentVersion: GameVersion | undefined;
  showCode: boolean;
}

export const GamePreview = forwardRef<HTMLIFrameElement, GamePreviewProps>(
  ({ currentVersion, showCode }, ref) => {
    const [contentReady, setContentReady] = useState(false);
    const [lastValidCode, setLastValidCode] = useState<string | null>(null);
    
    useEffect(() => {
      console.log("GamePreview received currentVersion update", currentVersion?.id, "showCode:", showCode);
      
      if (currentVersion?.code) {
        const codeLength = currentVersion.code.length;
        console.log("Code preview available, length:", codeLength);
        
        // Only set content as ready if we have valid code
        if (codeLength > 100 && currentVersion.code !== "Generating...") {
          setContentReady(true);
          setLastValidCode(currentVersion.code);
        }
      }
    }, [currentVersion]);

    // Handle case when no version is available yet
    if (!currentVersion) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading content...</p>
        </div>
      );
    }

    // Check if currentVersion has valid code
    const hasValidCode = currentVersion.code && 
                         currentVersion.code !== "Generating..." && 
                         currentVersion.code.length > 100; // More strict check
    
    // Use lastValidCode as fallback if we have it
    const displayCode = hasValidCode ? currentVersion.code : (lastValidCode || "");

    if (!hasValidCode && !lastValidCode) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Loading generated content...</p>
          <p className="text-gray-400 text-sm">This may take a moment to appear</p>
        </div>
      );
    }

    // Determine which view to show based on showCode flag
    if (!showCode) {
      return (
        <IframePreview 
          code={displayCode} 
          ref={ref} 
        />
      );
    } else {
      const { html, css, js } = parseCodeSections(displayCode);
      
      return (
        <div className="h-full relative">
          <CodeEditor html={html} css={css} js={js} />
        </div>
      );
    }
  }
);

GamePreview.displayName = "GamePreview";
