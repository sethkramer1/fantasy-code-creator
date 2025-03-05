
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

    // Add script to handle anchor clicks within the iframe
    const injectAnchorClickHandlers = () => {
      const iframe = localIframeRef.current;
      if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return;
      
      try {
        // Wait for iframe to load
        iframe.contentWindow.addEventListener('load', () => {
          // Add script to handle anchor clicks
          const script = iframe.contentDocument.createElement('script');
          script.textContent = `
            document.addEventListener('click', function(e) {
              // Handle anchor clicks
              if (e.target.tagName === 'A' || e.target.closest('a')) {
                const anchor = e.target.tagName === 'A' ? e.target : e.target.closest('a');
                const href = anchor.getAttribute('href');
                
                // Only handle same-page anchors
                if (href && href.startsWith('#')) {
                  e.preventDefault();
                  const targetElement = document.querySelector(href);
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                  }
                  return false;
                }
              }
            }, true);
          `;
          iframe.contentDocument.head.appendChild(script);
        });
      } catch (error) {
        console.error("Error injecting anchor handlers:", error);
      }
    };

    // Setup the iframe after it renders
    useEffect(() => {
      if (!localIframeRef.current || !code) return;
      
      const iframe = localIframeRef.current;
      
      // Add load event listener
      const handleLoad = () => {
        console.log("Iframe loaded successfully");
      };
      
      const handleError = () => {
        console.error("Iframe failed to load");
      };
      
      iframe.addEventListener('load', handleLoad);
      iframe.addEventListener('error', handleError);
      
      injectAnchorClickHandlers();
      
      return () => {
        iframe.removeEventListener('load', handleLoad);
        iframe.removeEventListener('error', handleError);
      };
    }, [code]);

    // This function ensures the iframe content is properly prepared and sanitized
    const getSafeIframeContent = () => {
      if (!code || code.length < 10) {
        return '<html><body><div style="display:flex;justify-content:center;align-items:center;height:100%;color:#888;">Preview not available</div></body></html>';
      }
      
      try {
        // Basic validation to ensure we have HTML content
        if (!code.includes('<html') && !code.includes('<!DOCTYPE') && !code.includes('<body')) {
          // Wrap code in basic HTML structure if it doesn't include proper HTML tags
          return `<!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <base target="_self">
              <style>
                html, body { height: 100%; margin: 0; overflow: auto; scroll-behavior: smooth; }
              </style>
            </head>
            <body>${code}</body>
            </html>`;
        }
        
        // If code already has HTML structure, enhance it with base target
        const enhancedCode = code.replace('<head>', 
          `<head>
            <base target="_self">
            <style>
              html, body {
                height: 100%;
                overflow: auto;
                scroll-behavior: smooth;
              }
            </style>`);
        
        return enhancedCode;
      } catch (error) {
        console.error("Error preparing iframe content:", error);
        return `<html><body><div style="color:red;padding:20px;">Error loading preview</div></body></html>`;
      }
    };
    
    // If there's no code, show a loading state
    if (!code) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      );
    }
    
    // Add debugging to track what's happening with the iframe content
    console.log("IframePreview rendering with code length:", code?.length);
    
    // Render the iframe with the code
    return (
      <iframe
        ref={localIframeRef}
        srcDoc={getSafeIframeContent()}
        className="absolute inset-0 w-full h-full"
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-pointer-lock"
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
