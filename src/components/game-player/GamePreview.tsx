import { useEffect, forwardRef, useState, useCallback, useRef } from "react";
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
    const [lastValidCode, setLastValidCode] = useState<string | null>(null);
    const [isStable, setIsStable] = useState(false);
    const prevVersionIdRef = useRef<string | null>(null);
    
    // Validate code function
    const isValidCode = useCallback((code: string | undefined): boolean => {
      if (!code) return false;
      if (code === "Generating...") return false;
      if (code.length < 100) return false;
      
      const hasHtmlStructure = 
        code.includes("<html") || 
        code.includes("<!DOCTYPE") || 
        code.includes("<svg");
        
      return hasHtmlStructure;
    }, []);
    
    // Handle version changes and code validation
    useEffect(() => {
      // Skip if same version and already stable
      if (currentVersion?.id === prevVersionIdRef.current && isStable) {
        return;
      }
      
      // Update version reference
      if (currentVersion?.id) {
        prevVersionIdRef.current = currentVersion.id;
      }

      // Validate and update code
      if (currentVersion?.code) {
        if (isValidCode(currentVersion.code)) {
          setLastValidCode(currentVersion.code);
          setIsStable(true);
        } else if (lastValidCode && isValidCode(lastValidCode)) {
          // Keep using last valid code
          setIsStable(true);
        } else if (currentVersion.code.length < 100 && currentVersion.code.length > 0 
                  && currentVersion.code.includes('<') && currentVersion.code.includes('>')) {
          // Handle short HTML snippets by wrapping them
          const wrappedCode = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
</head>
<body>
  ${currentVersion.code}
</body>
</html>`;
          setLastValidCode(wrappedCode);
          setIsStable(true);
        }
      }
    }, [currentVersion, isValidCode, lastValidCode]);

    // Handle case when no version is available yet
    if (!currentVersion) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Loading content...</p>
        </div>
      );
    }

    // Show loading state only if we don't have any valid code
    if (!isStable && !lastValidCode) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Loading generated content...</p>
          <p className="text-gray-400 text-sm max-w-md text-center px-4">
            Content is being processed...
          </p>
        </div>
      );
    }

    // Use lastValidCode as fallback if current code is invalid
    const displayCode = isValidCode(currentVersion.code) ? currentVersion.code : (lastValidCode || "");

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
