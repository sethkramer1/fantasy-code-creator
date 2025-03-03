
import React, { useRef, useEffect, forwardRef, memo } from "react";

interface IframePreviewProps {
  code: string;
}

export const IframePreview = memo(forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    
    // Forward the ref to parent component
    useEffect(() => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(localIframeRef.current);
      } else {
        ref.current = localIframeRef.current;
      }
    }, [ref]);

    // If there's no code, show a loading state
    if (!code) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      );
    }
    
    // Render the iframe with the code
    return (
      <iframe
        ref={localIframeRef}
        srcDoc={code}
        className="absolute inset-0 w-full h-full border border-gray-200"
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-top-navigation allow-pointer-lock"
        title="Generated Content"
        tabIndex={0}
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute', 
          overflow: 'auto', 
          pointerEvents: 'auto'
        }}
      />
    );
  }
));

IframePreview.displayName = "IframePreview";
