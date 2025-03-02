import { useEffect } from "react";
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

export function GamePreview({ currentVersion, showCode }: GamePreviewProps) {
  useEffect(() => {
    // This is kept to maintain the existing behavior where the component might
    // do something when the currentVersion changes
  }, [currentVersion]);

  if (!showCode) {
    return (
      <IframePreview code={currentVersion?.code || ""} />
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
