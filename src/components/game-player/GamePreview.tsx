
import { useEffect, forwardRef } from "react";
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
    useEffect(() => {
      console.log("GamePreview received currentVersion update", currentVersion?.id);
    }, [currentVersion]);

    if (!showCode) {
      return (
        <IframePreview 
          code={currentVersion?.code || ""} 
          ref={ref} 
        />
      );
    } else {
      const { html, css, js } = parseCodeSections(currentVersion?.code || "");
      
      return (
        <div className="h-full relative">
          <CodeEditor html={html} css={css} js={js} />
        </div>
      );
    }
  }
);

GamePreview.displayName = "GamePreview";
