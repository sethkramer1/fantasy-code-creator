
import { useEffect, forwardRef, useState, useCallback, useRef, memo } from "react";
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

// Create a memoized version to prevent unnecessary rerenders
const MemoizedIframePreview = memo(IframePreview);

export const GamePreview = forwardRef<HTMLIFrameElement, GamePreviewProps>(
  ({ currentVersion, showCode }, ref) => {
    const [processedCode, setProcessedCode] = useState<string | null>(null);
    const currentVersionIdRef = useRef<string | null>(null);
    
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
    
    // Process the code only when version changes
    useEffect(() => {
      // Skip if no version is available
      if (!currentVersion?.code || !currentVersion?.id) {
        return;
      }
      
      // Skip if this version has already been processed
      if (currentVersionIdRef.current === currentVersion.id && processedCode) {
        return;
      }
      
      // Process the code
      if (isValidCode(currentVersion.code)) {
        setProcessedCode(currentVersion.code);
        currentVersionIdRef.current = currentVersion.id;
      } 
      // Handle code fragments by wrapping them in HTML
      else if (currentVersion.code.length > 0 && 
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
        currentVersionIdRef.current = currentVersion.id;
      }
    }, [currentVersion, isValidCode, processedCode]);

    // Handle case when no version is available
    if (!currentVersion) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Loading content...</p>
        </div>
      );
    }

    // When we have processed code, render the appropriate view
    if (processedCode) {
      if (!showCode) {
        return (
          <div className="h-full relative">
            <MemoizedIframePreview code={processedCode} ref={ref} />
          </div>
        );
      } else {
        const { html, css, js } = parseCodeSections(processedCode);
        
        return (
          <div className="h-full relative overflow-hidden border border-gray-200 shadow-sm">
            <CodeEditor html={html} css={css} js={js} />
          </div>
        );
      }
    }

    // Show loading state
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="text-gray-500">Processing content...</p>
      </div>
    );
  }
);

GamePreview.displayName = "GamePreview";
