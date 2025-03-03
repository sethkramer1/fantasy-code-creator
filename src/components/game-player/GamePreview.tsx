
import { useEffect, forwardRef, useState, useCallback, useRef } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { IframePreview } from "./components/IframePreview";
import { toast } from "@/components/ui/use-toast";

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
    const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const prevVersionIdRef = useRef<string | null>(null);
    const stabilityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const processingRef = useRef(false);
    const stableContentRef = useRef(false);
    
    // Validate code function
    const isValidCode = useCallback((code: string | undefined): boolean => {
      if (!code) return false;
      if (code === "Generating...") return false;
      if (code.length < 100) return false;
      
      // Check if it contains basic HTML structure
      const hasHtmlStructure = 
        code.includes("<html") || 
        code.includes("<!DOCTYPE") || 
        code.includes("<svg");
        
      return hasHtmlStructure;
    }, []);
    
    // Check and handle version changes
    useEffect(() => {
      console.log("GamePreview received currentVersion update", 
        currentVersion?.id, 
        "showCode:", showCode,
        "code length:", currentVersion?.code?.length || 0,
        "processing:", processingRef.current,
        "stable:", stableContentRef.current
      );
      
      // If content is stable, don't reprocess
      if (stableContentRef.current && currentVersion?.id === prevVersionIdRef.current) {
        console.log("Content is stable, skipping processing");
        return;
      }
      
      // Prevent processing while another operation is in progress
      if (processingRef.current) {
        console.log("Still processing previous update, skipping");
        return;
      }
      
      // If version ID hasn't changed, don't proceed to avoid reload loops
      if (currentVersion?.id === prevVersionIdRef.current && !initialRenderRef.current) {
        console.log("Same version ID, skipping processing to avoid reload loop");
        return;
      }
      
      // Set processing flag
      processingRef.current = true;
      
      // Update ref to current version ID
      if (currentVersion?.id) {
        prevVersionIdRef.current = currentVersion.id;
      }
      
      // Clear any existing timeouts
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      
      if (stabilityTimerRef.current) {
        clearTimeout(stabilityTimerRef.current);
      }
      
      if (currentVersion?.code) {
        // Handle the case where code is "Generating..."
        if (currentVersion.code === "Generating...") {
          console.log("Generation still in progress");
          
          // Don't increase load attempts on first render
          if (!initialRenderRef.current) {
            setLoadAttempts(prev => prev + 1);
          }
          
          // Set a timeout to check status again, but don't auto-reload
          loadTimeoutRef.current = setTimeout(() => {
            console.log("Game still showing 'Generating...' after timeout");
            processingRef.current = false;
          }, 5000);
          
          return;
        }
        
        // If we have valid code, save it and set content as ready
        if (isValidCode(currentVersion.code)) {
          console.log("Valid code detected, setting as ready");
          setContentReady(true);
          setLastValidCode(currentVersion.code);
          setLoadAttempts(0); // Reset attempts counter
          
          // Mark content as stable to prevent unnecessary reloads
          stableContentRef.current = true;
          
          // Use a stability timer to prevent immediate state changes
          stabilityTimerRef.current = setTimeout(() => {
            processingRef.current = false;
          }, 1000);
        } else {
          console.log("Invalid or incomplete code received");
          
          // Check if code is too short but not empty
          if (currentVersion.code.length < 100 && currentVersion.code.length > 0) {
            console.warn("Code is too short:", currentVersion.code);
            
            // If we have some HTML tags, try to wrap it
            if (currentVersion.code.includes('<') && currentVersion.code.includes('>')) {
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
              
              console.log("Attempted to wrap short code in HTML");
              setLastValidCode(wrappedCode);
              setContentReady(true);
              stableContentRef.current = true;
              
              // Use a stability timer
              stabilityTimerRef.current = setTimeout(() => {
                processingRef.current = false;
              }, 1000);
              
              return;
            }
          }
          
          // If we already have valid code, don't use the invalid one
          if (lastValidCode && isValidCode(lastValidCode)) {
            console.log("Using previously saved valid code");
            stableContentRef.current = true;
            
            // Use a stability timer
            stabilityTimerRef.current = setTimeout(() => {
              processingRef.current = false;
            }, 1000);
          } else {
            // Increment load attempts for potentially showing error
            setLoadAttempts(prev => prev + 1);
            processingRef.current = false;
          }
        }
      } else {
        processingRef.current = false;
      }
      
      initialRenderRef.current = false;
      
      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        
        if (stabilityTimerRef.current) {
          clearTimeout(stabilityTimerRef.current);
          stabilityTimerRef.current = null;
        }
      };
    }, [currentVersion, showCode, isValidCode, lastValidCode]);

    // Show toast on multiple failed attempts - but limit frequency
    useEffect(() => {
      if (loadAttempts >= 3 && !lastValidCode) {
        toast({
          title: "Loading Issues",
          description: "Having trouble loading content. It may be incomplete or still generating.",
          variant: "destructive"
        });
      }
    }, [loadAttempts, lastValidCode]);

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
          <p className="text-gray-400 text-sm max-w-md text-center px-4">
            {loadAttempts >= 3 
              ? "Still working on it. You might need to refresh the page if this persists." 
              : "This may take a moment to appear. The content is being processed..."}
          </p>
          {loadAttempts >= 3 && (
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Refresh Page
            </button>
          )}
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
