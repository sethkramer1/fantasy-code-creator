import React, { useRef, useEffect, useState } from "react";

interface SimpleIframePreviewProps {
  code: string;
  onCodeUpdate?: (updatedCode: string) => void;
}

export const SimpleIframePreview: React.FC<SimpleIframePreviewProps> = ({
  code,
  onCodeUpdate
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Handle iframe load event
  const handleLoad = () => {
    console.log("Simple iframe loaded");
    setIframeLoaded(true);
  };

  // Prepare the iframe content
  const getIframeContent = () => {
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
          <p className="mt-4 text-gray-600">Loading preview...</p>
        </div>
      </div>
    );
  }
  
  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0"
      srcDoc={getIframeContent()}
      onLoad={handleLoad}
      sandbox="allow-same-origin allow-scripts"
    />
  );
};

SimpleIframePreview.displayName = "SimpleIframePreview";
