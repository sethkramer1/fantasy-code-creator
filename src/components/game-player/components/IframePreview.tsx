
import React, { useRef, useEffect, forwardRef } from "react";

interface IframePreviewProps {
  code: string;
}

export const IframePreview = forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    const codeRef = useRef<string>("");
    
    // Forward the ref to parent component
    useEffect(() => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(localIframeRef.current);
      } else {
        ref.current = localIframeRef.current;
      }
    }, [ref]);

    // Only update iframe content when code actually changes
    useEffect(() => {
      // Skip if code is exactly the same as previous
      if (codeRef.current === code) {
        return;
      }
      
      // Skip empty code or very short content
      if (!code || code.length < 10) {
        return;
      }
      
      // Store the new code in ref to prevent unnecessary updates
      codeRef.current = code;
      
    }, [code]);

    // Display loading state when no content
    if (!codeRef.current) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      );
    }
    
    // Only show iframe when we have stable content
    return (
      <iframe
        ref={localIframeRef}
        srcDoc={codeRef.current}
        className="absolute inset-0 w-full h-full border border-gray-100"
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
        title="Generated Content"
        tabIndex={0}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
      />
    );
  }
);

IframePreview.displayName = "IframePreview";
