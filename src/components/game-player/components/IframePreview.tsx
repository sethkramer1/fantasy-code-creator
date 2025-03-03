
import React, { useRef, useEffect, forwardRef, useState, useCallback } from "react";

interface IframePreviewProps {
  code: string;
}

export const IframePreview = forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeContent, setIframeContent] = useState<string>("");
    const prevCodeRef = useRef<string>("");
    const [isStable, setIsStable] = useState(false);
    const contentStabilizedRef = useRef<boolean>(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Forward the ref to parent component
    useEffect(() => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(localIframeRef.current);
      } else {
        ref.current = localIframeRef.current;
      }
    }, [ref]);

    // Cleanup timers on unmount
    useEffect(() => {
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }, []);

    // Update iframe content when code changes - with enhanced stability checks
    useEffect(() => {
      // If we already have stable content and the code hasn't changed, do nothing
      if (contentStabilizedRef.current && code === prevCodeRef.current) {
        return;
      }
      
      // Basic validation to avoid processing invalid code
      if (!code || code.length < 10) {
        return;
      }
      
      // Clear any existing timer to prevent race conditions
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Set a timer to update the content with debouncing
      timerRef.current = setTimeout(() => {
        // Update refs and state only if the code is different
        if (code !== prevCodeRef.current) {
          console.log("Updating iframe content");
          setIframeContent(code);
          prevCodeRef.current = code;
          setIsStable(true);
          contentStabilizedRef.current = true;
        }
        timerRef.current = null;
      }, 300); // Increased debounce time
      
    }, [code]);

    return (
      <div className="h-full relative">
        {iframeContent ? (
          <iframe
            ref={localIframeRef}
            srcDoc={iframeContent}
            className="absolute inset-0 w-full h-full border border-gray-100"
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            title="Generated Content"
            tabIndex={0}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}
      </div>
    );
  }
);

IframePreview.displayName = "IframePreview";
