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
    const contentStableRef = useRef<boolean>(false);
    const stableVersionCodeRef = useRef<string | null>(null);
    
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
    
    // Handle version changes and code validation - with enhanced stability
    useEffect(() => {
      // If we've already processed this version and have stable content, don't reprocess
      if (currentVersion?.id === prevVersionIdRef.current && contentStableRef.current) {
        return;
      }
      
      // If we don't have a current version with code, nothing to do
      if (!currentVersion?.code) {
        return;
      }
      
      // Check if current code is valid
      const isCurrentCodeValid = isValidCode(currentVersion.code);
      
      // Update version reference when we have a valid ID
      if (currentVersion.id) {
        prevVersionIdRef.current = currentVersion.id;
      }

      // Handle valid code case
      if (isCurrentCodeValid) {
        // Only update if the code has changed
        if (stableVersionCodeRef.current !== currentVersion.code) {
          console.log("Valid code detected, updating...");
          setLastValidCode(currentVersion.code);
          stableVersionCodeRef.current = currentVersion.code;
          setIsStable(true);
          contentStableRef.current = true;
        }
      } 
      // If current code isn't valid but we have last valid code
      else if (lastValidCode && isValidCode(lastValidCode)) {
        // Keep using last valid code
        contentStableRef.current = true;
        setIsStable(true);
      } 
      // Handle short HTML snippets by wrapping them
      else if (currentVersion.code.length < 100 && currentVersion.code.length > 0 
              && currentVersion.code.includes('<') && currentVersion.code.includes('>')) {
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
        
        if (stableVersionCodeRef.current !== wrappedCode) {
          setLastValidCode(wrappedCode);
          stableVersionCodeRef.current = wrappedCode;
          setIsStable(true);
          contentStableRef.current = true;
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

    // Show loading state only if we don't have any valid code AND we're not stable yet
    if (!contentStableRef.current && !lastValidCode) {
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
    const displayCode = isValidCode(currentVersion.code) ? 
      currentVersion.code : (lastValidCode || "");

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
