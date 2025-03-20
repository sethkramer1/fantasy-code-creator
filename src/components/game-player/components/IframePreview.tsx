import React, { useRef, useEffect, forwardRef, memo, useState } from "react";

interface IframePreviewProps {
  code: string;
  onCodeUpdate?: (updatedCode: string) => void;
}

export const IframePreview = memo(forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code, onCodeUpdate }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    
    // Forward the ref to parent component
    useEffect(() => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(localIframeRef.current);
      } else {
        ref.current = localIframeRef.current;
      }
    }, [ref]);

    // Handle iframe load event
    const handleLoad = () => {
      console.log("Iframe loaded");
      setIframeLoaded(true);
    };

    // Get safe iframe content
    const getSafeIframeContent = () => {
      if (!code) return '';
      
      // If it's a complete HTML document
      if (code.includes('<!DOCTYPE') || code.includes('<html')) {
        return code;
      }
      
      // Otherwise, wrap in a basic HTML structure
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  ${code}
</body>
</html>`;
    };
    
    // If there's no code, show a loading state
    if (!code) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading game...</p>
          </div>
        </div>
      );
    }
    
    return (
      <iframe
        ref={localIframeRef}
        className="w-full h-full border-0"
        srcDoc={getSafeIframeContent()}
        onLoad={handleLoad}
        sandbox="allow-same-origin allow-scripts"
      />
    );
  }
));

IframePreview.displayName = "IframePreview";
