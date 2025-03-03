
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
    const [processedCode, setProcessedCode] = useState<string | null>(null);
    const isInitialRender = useRef(true);
    
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
    
    // Process the code when currentVersion changes
    useEffect(() => {
      // Skip if no version is available
      if (!currentVersion?.code) {
        return;
      }
      
      // Check if current code is valid
      if (isValidCode(currentVersion.code)) {
        console.log("Valid code detected in GamePreview, length:", currentVersion.code.length);
        setProcessedCode(currentVersion.code);
      } 
      // Handle short HTML snippets by wrapping them
      else if (currentVersion.code.length < 100 && 
               currentVersion.code.length > 0 && 
               currentVersion.code.includes('<') && 
               currentVersion.code.includes('>')) {
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
        
        setProcessedCode(wrappedCode);
      }
      
      // After first render, clear the initial flag
      isInitialRender.current = false;
    }, [currentVersion, isValidCode]);

    // Handle case when no version is available yet
    if (!currentVersion) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Loading content...</p>
        </div>
      );
    }

    // Show loading state only if we don't have processed code
    if (!processedCode) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Processing content...</p>
          <p className="text-gray-400 text-sm max-w-md text-center px-4">
            Please wait while the content is being prepared...
          </p>
        </div>
      );
    }

    // Determine which view to show based on showCode flag
    if (!showCode) {
      return (
        <IframePreview 
          code={processedCode} 
          ref={ref} 
        />
      );
    } else {
      const { html, css, js } = parseCodeSections(processedCode);
      
      return (
        <div className="h-full relative">
          <CodeEditor html={html} css={css} js={js} />
        </div>
      );
    }
  }
);

GamePreview.displayName = "GamePreview";
