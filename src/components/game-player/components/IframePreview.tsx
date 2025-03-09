import React, { useRef, useEffect, forwardRef, memo, useState } from "react";

interface IframePreviewProps {
  code: string;
  onCodeUpdate?: (updatedCode: string) => void;
  isEditable?: boolean;
}

export const IframePreview = memo(forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code, onCodeUpdate, isEditable = false }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const scriptInjectedRef = useRef(false);
    const [editModeEnabled, setEditModeEnabled] = useState(false);
    
    // Forward the ref to parent component
    useEffect(() => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(localIframeRef.current);
      } else {
        ref.current = localIframeRef.current;
      }
    }, [ref]);

    // This function directly enables edit mode in the iframe
    const enableEditModeDirectly = () => {
      const iframe = localIframeRef.current;
      if (!iframe || !iframe.contentWindow || !iframe.contentDocument) {
        console.error("Cannot enable edit mode: iframe, contentWindow, or contentDocument is null");
        return;
      }
      
      try {
        console.log("Directly enabling edit mode in iframe");
        
        // Find all text elements that could be edited
        const textElements = iframe.contentDocument.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a, button, li, td, th, label');
        console.log("Found", textElements.length, "text elements to evaluate for editing");
        
        // Make elements editable
        let editableCount = 0;
        textElements.forEach((el: HTMLElement) => {
          // Skip elements with no text or only whitespace
          if (!el.textContent || el.textContent.trim() === '') return;
          
          // Skip elements with significant child elements
          if (el.querySelector('img, video, iframe, canvas, svg')) return;
          
          // Skip elements that contain other text elements (to avoid nested editables)
          if (el.querySelector('p, h1, h2, h3, h4, h5, h6, span, a, button, li')) return;
          
          // Skip elements with very short text (likely icons or symbols)
          if (el.textContent.trim().length < 2) return;
          
          try {
            // Make element editable
            el.contentEditable = 'true';
            el.setAttribute('data-editable', 'true');
            
            // Remove any existing click listeners to prevent duplicates
            const newEl = el.cloneNode(true) as HTMLElement;
            el.parentNode?.replaceChild(newEl, el);
            
            // Add click event listener to the new element
            newEl.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent event bubbling
              e.preventDefault(); // Prevent default behavior
              console.log("Element clicked:", newEl.tagName);
              
              const target = e.currentTarget as HTMLElement;
              target.focus();
              
              // Create a selection range to position cursor at end of text
              if (iframe.contentDocument?.createRange && iframe.contentWindow?.getSelection) {
                const range = iframe.contentDocument.createRange();
                const selection = iframe.contentWindow.getSelection();
                range.selectNodeContents(target);
                range.collapse(false); // false means collapse to end
                selection?.removeAllRanges();
                selection?.addRange(range);
              }
            });
            
            editableCount++;
          } catch (err) {
            console.error("Error making element editable:", err);
          }
        });
        console.log("Made", editableCount, "elements editable");
        
        // Add edit mode styles
        let style = iframe.contentDocument.getElementById('edit-mode-styles');
        if (!style) {
          style = iframe.contentDocument.createElement('style');
          style.id = 'edit-mode-styles';
          style.textContent = `
            [data-editable="true"] {
              outline: 2px dashed #4299e1 !important;
              cursor: text !important;
              min-height: 1em;
              min-width: 1em;
              padding: 2px;
              transition: outline 0.2s, background-color 0.2s;
            }
            [data-editable="true"]:hover {
              outline: 2px dashed #3182ce !important;
              background-color: rgba(66, 153, 225, 0.1) !important;
            }
            [data-editable="true"]:focus {
              outline: 3px solid #3182ce !important;
              background-color: rgba(66, 153, 225, 0.2) !important;
            }
          `;
          iframe.contentDocument.head.appendChild(style);
        }
        
        // Add input event listener if not already added
        if (!iframe.contentWindow._editListenerAdded) {
          // Listen for input events (text changes)
          iframe.contentDocument.addEventListener('input', function(e) {
            const target = e.target as HTMLElement;
            if (target.dataset.editable === 'true') {
              console.log("Input event fired, posting TEXT_UPDATED");
              
              // Send the updated HTML to the parent
              if (onCodeUpdate) {
                onCodeUpdate(iframe.contentDocument!.documentElement.outerHTML);
              }
              
              window.parent.postMessage({
                type: 'TEXT_UPDATED',
                html: iframe.contentDocument!.documentElement.outerHTML
              }, '*');
            }
          });
          
          // Add focus event listener to highlight the current editable element
          iframe.contentDocument.addEventListener('focus', function(e) {
            const target = e.target as HTMLElement;
            if (target.dataset.editable === 'true') {
              console.log("Focus on editable element:", target.tagName);
              
              // Make sure the element is visible
              target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, true);
          
          // Add a click handler to the document to ensure clicks work properly
          iframe.contentDocument.addEventListener('click', function(e) {
            const target = e.target as HTMLElement;
            if (target.dataset.editable === 'true') {
              console.log("Click on editable element:", target.tagName);
              target.focus();
              
              // Create a selection range to position cursor at end of text
              if (iframe.contentDocument?.createRange && iframe.contentWindow?.getSelection) {
                const range = iframe.contentDocument.createRange();
                const selection = iframe.contentWindow.getSelection();
                range.selectNodeContents(target);
                range.collapse(false); // false means collapse to end
                selection?.removeAllRanges();
                selection?.addRange(range);
              }
              
              e.stopPropagation();
              e.preventDefault();
            }
          }, true);
          
          // Add keydown event listener to handle enter key properly
          iframe.contentDocument.addEventListener('keydown', function(e) {
            const target = e.target as HTMLElement;
            if (target.dataset.editable === 'true') {
              // Handle Enter key to prevent creating new lines in elements that shouldn't have them
              if (e.key === 'Enter' && !['DIV', 'P', 'TEXTAREA'].includes(target.tagName)) {
                e.preventDefault();
                // Blur the element to finish editing
                target.blur();
              }
            }
          });
          
          iframe.contentWindow._editListenerAdded = true;
        }
        
        // Set a flag to indicate edit mode is enabled
        setEditModeEnabled(true);
        
        // Add a message to let users know they can edit
        const messageEl = iframe.contentDocument.createElement('div');
        messageEl.id = 'edit-mode-message';
        messageEl.style.cssText = `
          position: fixed;
          bottom: 10px;
          right: 10px;
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          z-index: 9999;
          pointer-events: none;
          animation: fadeOut 3s forwards 2s;
        `;
        messageEl.textContent = 'Click on any text to edit';
        
        // Add animation for the message
        const styleAnimation = iframe.contentDocument.createElement('style');
        styleAnimation.textContent = `
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; visibility: hidden; }
          }
        `;
        iframe.contentDocument.head.appendChild(styleAnimation);
        
        // Remove existing message if present
        const existingMessage = iframe.contentDocument.getElementById('edit-mode-message');
        if (existingMessage) existingMessage.remove();
        
        iframe.contentDocument.body.appendChild(messageEl);
      } catch (error) {
        console.error("Error directly enabling edit mode:", error);
      }
    };
    
    // This function directly disables edit mode in the iframe
    const disableEditModeDirectly = () => {
      const iframe = localIframeRef.current;
      if (!iframe || !iframe.contentDocument) {
        console.error("Cannot disable edit mode: iframe or contentDocument is null");
        return;
      }
      
      try {
        console.log("Directly disabling edit mode in iframe");
        
        // Remove edit mode from all elements
        iframe.contentDocument.querySelectorAll('[data-editable="true"]').forEach((el: HTMLElement) => {
          try {
            el.contentEditable = 'false';
            el.removeAttribute('data-editable');
            
            // Remove event listeners (not strictly necessary but good practice)
            el.replaceWith(el.cloneNode(true));
          } catch (err) {
            console.error("Error disabling edit mode for element:", err);
          }
        });
        
        // Remove edit mode styles
        const style = iframe.contentDocument.getElementById('edit-mode-styles');
        if (style) style.remove();
        
        // Reset the edit mode flag
        setEditModeEnabled(false);
      } catch (error) {
        console.error("Error directly disabling edit mode:", error);
      }
    };

    // Setup the iframe and inject scripts
    useEffect(() => {
      const iframe = localIframeRef.current;
      if (!iframe) return;
      
      const handleLoad = () => {
        try {
          console.log("Iframe loaded");
          setIframeLoaded(true);
          scriptInjectedRef.current = true;
          
          if (!iframe.contentDocument) {
            console.error("No contentDocument available");
            return;
          }
          
          // Add input event listener for text updates
          iframe.contentDocument.addEventListener('input', function(e) {
            const target = e.target as HTMLElement;
            if (target.dataset?.editable === 'true') {
              console.log("Text updated in iframe");
              if (onCodeUpdate) {
                onCodeUpdate(iframe.contentDocument!.documentElement.outerHTML);
              }
            }
          });
          
          // If isEditable is true when iframe loads, enable edit mode
          if (isEditable) {
            console.log("Iframe loaded with isEditable=true, enabling edit mode");
            setTimeout(enableEditModeDirectly, 100);
          }
        } catch (error) {
          console.error("Error setting up iframe:", error);
        }
      };
      
      iframe.addEventListener('load', handleLoad);
      
      return () => {
        iframe.removeEventListener('load', handleLoad);
      };
    }, [isEditable, onCodeUpdate]);
    
    // Toggle edit mode when isEditable prop changes
    useEffect(() => {
      console.log("isEditable changed to", isEditable);
      
      if (!iframeLoaded || !scriptInjectedRef.current) {
        console.log("Iframe not fully loaded yet, will handle edit mode after load");
        return;
      }
      
      if (isEditable && !editModeEnabled) {
        console.log("Enabling edit mode directly");
        enableEditModeDirectly();
        
        // Try again after a short delay to ensure it works
        setTimeout(enableEditModeDirectly, 500);
      } else if (!isEditable && editModeEnabled) {
        console.log("Disabling edit mode directly");
        disableEditModeDirectly();
      }
    }, [isEditable, iframeLoaded, editModeEnabled]);
    
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
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

// Add TypeScript interface for Window to include custom property
declare global {
  interface Window {
    _editListenerAdded?: boolean;
  }
}
