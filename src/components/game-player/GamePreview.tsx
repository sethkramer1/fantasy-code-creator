
import { useEffect, forwardRef, useState, useCallback, useRef } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { IframePreview } from "./components/IframePreview";
import { toast } from "sonner";

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
    const [loadAttempts, setLoadAttempts] = useState(0);
    const initialRenderRef = useRef(true);
    
    // Validate code function
    const isValidCode = useCallback((code: string | undefined): boolean => {
      return Boolean(
        code && 
        code !== "Generating..." && 
        code.length > 100 &&
        (code.includes("<html") || code.includes("<!DOCTYPE") || code.includes("<svg"))
      );
    }, []);
    
    // Check and handle version changes
    useEffect(() => {
      console.log("GamePreview received currentVersion update", 
        currentVersion?.id, 
        "showCode:", showCode,
        "code length:", currentVersion?.code?.length,
        "code starts with:", currentVersion?.code?.substring(0, 30)
      );
      
      if (currentVersion?.code) {
        // Handle the case where code is "Generating..."
        if (currentVersion.code === "Generating...") {
          console.log("Generation still in progress");
          
          // Don't increase load attempts on first render
          if (!initialRenderRef.current) {
            setLoadAttempts(prev => prev + 1);
          }
          
          return;
        }
        
        // If we have valid code, save it and set content as ready
        if (isValidCode(currentVersion.code)) {
          console.log("Valid code detected, setting as ready");
          setContentReady(true);
          setLastValidCode(currentVersion.code);
          setLoadAttempts(0); // Reset attempts counter
        } else {
          console.log("Invalid or incomplete code received:", 
            currentVersion.code.substring(0, 100)
          );
          
          // If we already have valid code, don't use the invalid one
          if (lastValidCode && isValidCode(lastValidCode)) {
            console.log("Using previously saved valid code");
          } else {
            // Increment load attempts for potentially showing error
            setLoadAttempts(prev => prev + 1);
          }
        }
      }
      
      initialRenderRef.current = false;
    }, [currentVersion, showCode, isValidCode, lastValidCode]);

    // Show toast on multiple failed attempts
    useEffect(() => {
      if (loadAttempts >= 3 && !lastValidCode) {
        toast.error("Having trouble loading content. It may be incomplete.", {
          duration: 5000,
        });
      }
    }, [loadAttempts, lastValidCode]);

    // Force reload for "Generating..." case after 5 seconds
    useEffect(() => {
      let reloadTimer: NodeJS.Timeout;
      
      if (currentVersion?.code === "Generating..." && loadAttempts > 1) {
        reloadTimer = setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
      
      return () => {
        if (reloadTimer) clearTimeout(reloadTimer);
      };
    }, [currentVersion?.code, loadAttempts]);

    // Handle case when no version is available yet
    if (!currentVersion) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Loading content...</p>
        </div>
      );
    }

    // Check if currentVersion has valid code
    const hasValidCode = isValidCode(currentVersion.code);
    
    // Use lastValidCode as fallback if we have it
    const displayCode = hasValidCode ? currentVersion.code : (lastValidCode || "");

    if (!hasValidCode && !lastValidCode) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 flex-col gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-gray-500">Loading generated content...</p>
          <p className="text-gray-400 text-sm max-w-md text-center">
            {loadAttempts >= 3 
              ? "Still working on it. You might need to refresh the page if this persists." 
              : "This may take a moment to appear. The content is being processed..."}
          </p>
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
