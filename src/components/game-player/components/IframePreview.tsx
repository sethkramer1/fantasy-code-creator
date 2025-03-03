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
    
    // Forward the ref to parent component
    useEffect(() => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(localIframeRef.current);
      } else {
        ref.current = localIframeRef.current;
      }
    }, [ref]);

    // Update iframe content when code changes
    useEffect(() => {
      // Skip if code is empty, unchanged, or too short
      if (!code || code.length < 10 || (code === prevCodeRef.current && isStable)) {
        return;
      }
      
      // Update the content after a short delay to prevent flicker
      const timer = setTimeout(() => {
        setIframeContent(code);
        prevCodeRef.current = code;
        setIsStable(true);
      }, 100);
      
      return () => clearTimeout(timer);
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
