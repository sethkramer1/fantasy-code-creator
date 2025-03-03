
import React, { useRef, useEffect, forwardRef, useState } from "react";

interface IframePreviewProps {
  code: string;
}

export const IframePreview = forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeContent, setIframeContent] = useState<string>("");
    const contentStabilizedRef = useRef<boolean>(false);
    const prevCodeRef = useRef<string>("");
    
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
      // Skip if code is exactly the same as previous to prevent unnecessary rerenders
      if (prevCodeRef.current === code) {
        return;
      }
      
      // Skip empty code
      if (!code || code.length < 10) {
        return;
      }
      
      console.log("Setting iframe content with code length:", code.length);
      setIframeContent(code);
      prevCodeRef.current = code;
      contentStabilizedRef.current = true;
      
    }, [code]);

    // Simply render the iframe when we have content
    if (iframeContent) {
      return (
        <iframe
          ref={localIframeRef}
          srcDoc={iframeContent}
          className="absolute inset-0 w-full h-full border border-gray-100"
          sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
          title="Generated Content"
          tabIndex={0}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
        />
      );
    }
    
    // Loading state when no content
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }
);

IframePreview.displayName = "IframePreview";
