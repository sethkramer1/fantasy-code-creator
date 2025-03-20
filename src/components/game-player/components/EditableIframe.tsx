import React, { useRef, useEffect, useState, forwardRef, useCallback } from "react";

interface EditableIframeProps {
  code: string;
  isEditing: boolean;
  onCodeUpdate?: (updatedCode: string) => void;
}

export const EditableIframe = forwardRef<HTMLIFrameElement, EditableIframeProps>(
  ({ code, isEditing, onCodeUpdate }, ref) => {
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
      console.log("Editable iframe loaded");
      setIframeLoaded(true);
    };

    // Apply editing settings based on isEditing state
    const applyEditingSettings = useCallback(() => {
      if (!localIframeRef.current || !localIframeRef.current.contentDocument) {
        console.log("Cannot access iframe document");
        return;
      }
      
      const doc = localIframeRef.current.contentDocument;
      
      // Find all elements with .editable class
      const editableElements = doc.querySelectorAll('.editable');
      
      if (isEditing) {
        // If no elements have .editable class, make all text elements editable
        if (editableElements.length === 0) {
          const textElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div:not(:has(*)), li, a, button');
          
          textElements.forEach((element) => {
            if (element.textContent && element.textContent.trim() !== '') {
              element.classList.add('editable');
              makeElementEditable(element as HTMLElement);
            }
          });
        } else {
          // Make all elements with .editable class editable
          editableElements.forEach((element) => {
            makeElementEditable(element as HTMLElement);
          });
        }
        
        // Add CSS for visual feedback
        let style = doc.querySelector('style[data-edit-mode="true"]');
        
        if (!style) {
          style = doc.createElement('style');
          style.setAttribute('data-edit-mode', 'true');
          style.textContent = `
            .editable {
              outline: 2px dashed #3b82f6;
              padding: 2px;
              min-height: 1em;
              position: relative;
            }
            .editable:hover {
              outline: 2px dashed #2563eb;
              background-color: rgba(59, 130, 246, 0.1);
            }
            .editable:focus {
              outline: 2px solid #2563eb;
              background-color: rgba(59, 130, 246, 0.1);
            }
          `;
          doc.head.appendChild(style);
        }
      } else {
        // Disable edit mode
        editableElements.forEach((element) => {
          (element as HTMLElement).contentEditable = 'false';
          (element as HTMLElement).style.cursor = '';
        });
        
        // Remove the edit mode styles
        const editStyles = doc.querySelector('style[data-edit-mode="true"]');
        if (editStyles) {
          editStyles.remove();
        }
      }
    }, [isEditing]);
    
    // Make an element editable
    const makeElementEditable = (element: HTMLElement) => {
      element.contentEditable = 'true';
      element.style.cursor = 'text';
      
      // Prevent default behaviors that might interfere with editing
      element.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    };
    
    // Apply editing settings when iframe is loaded or isEditing changes
    useEffect(() => {
      if (!iframeLoaded) return;
      
      console.log("Applying editing settings, isEditing:", isEditing);
      applyEditingSettings();
    }, [isEditing, iframeLoaded, applyEditingSettings]);
    
    // Set up load event handler to apply editing settings after each load
    useEffect(() => {
      const iframe = localIframeRef.current;
      
      if (!iframe) return;
      
      const loadHandler = () => {
        setIframeLoaded(true);
        // Apply editing settings after a short delay to ensure DOM is ready
        setTimeout(() => {
          applyEditingSettings();
        }, 100);
      };
      
      iframe.addEventListener('load', loadHandler);
      
      return () => {
        iframe.removeEventListener('load', loadHandler);
      };
    }, [applyEditingSettings]);
    
    // Get the current HTML content of the iframe
    const getIframeContent = () => {
      if (!localIframeRef.current || !localIframeRef.current.contentDocument) {
        return '';
      }
      
      return localIframeRef.current.contentDocument.documentElement.outerHTML;
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
            <p className="mt-4 text-gray-600">Loading preview...</p>
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
);

EditableIframe.displayName = "EditableIframe";
