
import { useEffect, forwardRef, useState } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { IframePreview } from "./components/IframePreview";
import { ResizableIframeContainer } from "./components/ResizableIframeContainer";

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
  isResizable?: boolean;
}

export const GamePreview = forwardRef<HTMLIFrameElement, GamePreviewProps>(
  ({ currentVersion, showCode, isResizable = true }, ref) => {
    const [iframeSize, setIframeSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
      console.log("GamePreview received currentVersion update", currentVersion?.id);
    }, [currentVersion]);

    const handleIframeResize = (width: number, height: number) => {
      setIframeSize({ width, height });
      // Could send resize message to iframe if needed
    };

    // Handle case when no version is available yet
    if (!currentVersion) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading content...</p>
        </div>
      );
    }

    if (!showCode) {
      const iframePreviewContent = (
        <IframePreview 
          code={currentVersion.code || ""} 
          ref={ref} 
        />
      );

      if (isResizable) {
        return (
          <ResizableIframeContainer onResize={handleIframeResize}>
            {iframePreviewContent}
          </ResizableIframeContainer>
        );
      }

      return iframePreviewContent;
    } else {
      const { html, css, js } = parseCodeSections(currentVersion.code || "");
      
      return (
        <div className="h-full relative">
          <CodeEditor html={html} css={css} js={js} />
        </div>
      );
    }
  }
);

GamePreview.displayName = "GamePreview";
