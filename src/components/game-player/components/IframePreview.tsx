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
        
        // Check if document is ready
        if (iframe.contentDocument.readyState !== 'complete') {
          console.log("Document not ready, trying again in 100ms");
          setTimeout(enableEditModeDirectly, 100);
          return;
        }
        
        // Store edit mode state in sessionStorage
        try {
          if (iframe.contentWindow.sessionStorage) {
            iframe.contentWindow.sessionStorage.setItem('editMode', 'true');
            console.log("Stored edit mode state in sessionStorage: true");
          }
        } catch (error) {
          console.error("Error storing edit mode in sessionStorage:", error);
        }
        
        // Create a script element to inject into the iframe
        const script = iframe.contentDocument.createElement('script');
        script.id = 'edit-mode-script';
        
        // Define the script content as a string with string concatenation instead of template literals
        script.textContent = 
          "(function() {" +
          "  console.log('Edit mode script running');" +
          "  " +
          "  // Debug function to show what elements are being processed" +
          "  function logElementInfo(el, reason) {" +
          "    const tagName = el.tagName.toLowerCase();" +
          "    const classes = el.className ? '.' + el.className.replace(/ /g, '.') : '';" +
          "    const id = el.id ? '#' + el.id : '';" +
          "    const text = el.textContent ? el.textContent.substring(0, 20).replace(/\\s+/g, ' ').trim() + '...' : '';" +
          "    console.log(`${reason}: ${tagName}${id}${classes} - '${text}'`);" +
          "  }" +
          "  " +
          "  // Find all text elements" +
          "  const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, a, button, li, td, th, label, strong, em, b, i');" +
          "  console.log('Found', textElements.length, 'potential text elements');" +
          "  " +
          "  // Make elements with text content editable" +
          "  let editableCount = 0;" +
          "  textElements.forEach(el => {" +
          "    // Skip elements with no text content" +
          "    if (!el.textContent || el.textContent.trim() === '') {" +
          "      logElementInfo(el, 'Skipping (no text)');" +
          "      return;" +
          "    }" +
          "    " +
          "    // Skip elements with images or other complex content" +
          "    if (el.querySelector('img, video, iframe, canvas, svg')) {" +
          "      logElementInfo(el, 'Skipping (has complex content)');" +
          "      return;" +
          "    }" +
          "    " +
          "    // Skip elements that are likely containers with many children" +
          "    if (el.children.length > 5) {" +
          "      logElementInfo(el, 'Skipping (too many children)');" +
          "      return;" +
          "    }" +
          "    " +
          "    // Check if this element has direct text content" +
          "    let hasDirectText = false;" +
          "    for (let i = 0; i < el.childNodes.length; i++) {" +
          "      if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent && el.childNodes[i].textContent.trim()) {" +
          "        hasDirectText = true;" +
          "        break;" +
          "      }" +
          "    }" +
          "    " +
          "    // Make editable if it's a heading, has direct text, or is a small element with text" +
          "    if (el.tagName.match(/^H[1-6]$/) || hasDirectText || (el.textContent.trim().length > 0 && el.children.length < 3)) {" +
          "      el.contentEditable = 'true';" +
          "      el.dataset.editable = 'true';" +
          "      logElementInfo(el, 'Made editable');" +
          "      " +
          "      // Prevent default behavior for links and buttons" +
          "      if (el.tagName === 'A' || el.tagName === 'BUTTON') {" +
          "        el.addEventListener('click', function(e) {" +
          "          e.preventDefault();" +
          "          e.stopPropagation();" +
          "        });" +
          "      }" +
          "      " +
          "      editableCount++;" +
          "    }" +
          "  });" +
          "  " +
          "  // Special handling for retro-styled elements" +
          "  const retroElements = document.querySelectorAll('[class*=\"retro\"], [class*=\"pixel\"], [style*=\"monospace\"], [style*=\"courier\"]');" +
          "  retroElements.forEach(el => {" +
          "    if (el.textContent && el.textContent.trim()) {" +
          "      el.contentEditable = 'true';" +
          "      el.dataset.editable = 'true';" +
          "      editableCount++;" +
          "    }" +
          "  });" +
          "  " +
          "  console.log('Made', editableCount, 'elements editable');" +
          "  " +
          "  // Add styles for editable elements" +
          "  const style = document.createElement('style');" +
          "  style.id = 'edit-mode-styles';" +
          "  style.textContent = " +
          "    '[data-editable=\"true\"] {" +
          "      outline: 3px solid #ff6b00 !important;" +
          "      cursor: text !important;" +
          "      min-height: 1em;" +
          "      min-width: 1em;" +
          "      position: relative;" +
          "    }" +
          "    [data-editable=\"true\"]:hover {" +
          "      outline: 3px dashed #ff8c00 !important;" +
          "      background-color: rgba(255, 107, 0, 0.1) !important;" +
          "    }" +
          "    [data-editable=\"true\"]:focus {" +
          "      outline: 4px solid #ff6b00 !important;" +
          "      background-color: rgba(255, 107, 0, 0.2) !important;" +
          "    }';" +
          "  document.head.appendChild(style);" +
          "  " +
          "  // Create a function to send updates to parent" +
          "  function sendUpdateToParent() {" +
          "    console.log('Sending update to parent');" +
          "    try {" +
          "      window.parent.postMessage({" +
          "        type: 'TEXT_UPDATED'," +
          "        html: document.documentElement.outerHTML" +
          "      }, '*');" +
          "    } catch (err) {" +
          "      console.error('Error sending message to parent:', err);" +
          "    }" +
          "  }" +
          "  " +
          "  // Add multiple event listeners to ensure changes are captured" +
          "  document.addEventListener('input', function(e) {" +
          "    if (e.target.dataset && e.target.dataset.editable === 'true') {" +
          "      console.log('Text changed (input):', e.target.textContent.substring(0, 20));" +
          "      sendUpdateToParent();" +
          "    }" +
          "  });" +
          "  " +
          "  document.addEventListener('blur', function(e) {" +
          "    if (e.target.dataset && e.target.dataset.editable === 'true') {" +
          "      console.log('Element blurred after edit:', e.target.textContent.substring(0, 20));" +
          "      sendUpdateToParent();" +
          "    }" +
          "  }, true);" +
          "  " +
          "  // Add message to indicate edit mode" +
          "  const messageEl = document.createElement('div');" +
          "  messageEl.id = 'edit-mode-message';" +
          "  messageEl.style.position = 'fixed';" +
          "  messageEl.style.bottom = '10px';" +
          "  messageEl.style.left = '10px';" +
          "  messageEl.style.backgroundColor = '#ff6b00';" +
          "  messageEl.style.color = 'white';" +
          "  messageEl.style.padding = '8px 12px';" +
          "  messageEl.style.borderRadius = '4px';" +
          "  messageEl.style.fontSize = '14px';" +
          "  messageEl.style.zIndex = '9999';" +
          "  messageEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';" +
          "  messageEl.textContent = 'Click on any text to edit';" +
          "  document.body.appendChild(messageEl);" +
          "  " +
          "  // Create a debug button to manually trigger an update" +
          "  const debugButton = document.createElement('button');" +
          "  debugButton.id = 'debug-update-button';" +
          "  debugButton.style.position = 'fixed';" +
          "  debugButton.style.bottom = '10px';" +
          "  debugButton.style.right = '10px';" +
          "  debugButton.style.backgroundColor = '#0066ff';" +
          "  debugButton.style.color = 'white';" +
          "  debugButton.style.padding = '8px 12px';" +
          "  debugButton.style.borderRadius = '4px';" +
          "  debugButton.style.fontSize = '14px';" +
          "  debugButton.style.zIndex = '9999';" +
          "  debugButton.style.border = 'none';" +
          "  debugButton.style.cursor = 'pointer';" +
          "  debugButton.textContent = 'Apply Changes';" +
          "  debugButton.addEventListener('click', function() {" +
          "    console.log('Manual update triggered');" +
          "    sendUpdateToParent();" +
          "  });" +
          "  document.body.appendChild(debugButton);" +
          "  " +
          "  console.log('Edit mode enabled');" +
          "})();";
        
        // Remove any existing script
        const existingScript = iframe.contentDocument.getElementById('edit-mode-script');
        if (existingScript) {
          existingScript.remove();
        }
        
        // Add the script to the iframe
        iframe.contentDocument.head.appendChild(script);
        
        // Set flag to indicate edit mode is enabled
        setEditModeEnabled(true);
        
      } catch (error) {
        console.error("Error enabling edit mode:", error);
      }
    };
    
    // This function directly disables edit mode in the iframe
    const disableEditModeDirectly = () => {
      const iframe = localIframeRef.current;
      if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return;
      
      try {
        console.log("Disabling edit mode in iframe");
        
        // Create a script to disable edit mode
        const script = iframe.contentDocument.createElement('script');
        script.textContent = 
          "(function() {" +
          "  // Find all editable elements" +
          "  const editableElements = document.querySelectorAll('[data-editable=\"true\"]');" +
          "  " +
          "  // Make elements non-editable" +
          "  editableElements.forEach(el => {" +
          "    el.contentEditable = 'false';" +
          "    delete el.dataset.editable;" +
          "  });" +
          "  " +
          "  // Remove edit mode styles" +
          "  const style = document.getElementById('edit-mode-styles');" +
          "  if (style) {" +
          "    style.remove();" +
          "  }" +
          "  " +
          "  // Remove edit mode message" +
          "  const messageEl = document.getElementById('edit-mode-message');" +
          "  if (messageEl) {" +
          "    messageEl.remove();" +
          "  }" +
          "  " +
          "  console.log('Edit mode disabled');" +
          "})();";
        
        // Add the script to the iframe
        iframe.contentDocument.head.appendChild(script);
        
        // Set flag to indicate edit mode is disabled
        setEditModeEnabled(false);
        
      } catch (error) {
        console.error("Error disabling edit mode:", error);
      }
    };

    // Setup the iframe and inject scripts
    useEffect(() => {
      const iframe = localIframeRef.current;
      if (!iframe) return;
      
      const handleLoad = () => {
        console.log("Iframe loaded");
        setIframeLoaded(true);
        
        // Reset the script injected flag when the iframe is reloaded
        scriptInjectedRef.current = false;
        
        // Check if there's an edit mode state in sessionStorage
        try {
          if (iframe && iframe.contentWindow && iframe.contentWindow.sessionStorage) {
            const storedEditMode = iframe.contentWindow.sessionStorage.getItem('editMode');
            console.log("Found stored edit mode:", storedEditMode);
            
            if (storedEditMode === 'true') {
              console.log("Applying edit mode from sessionStorage");
              // Use a timeout to ensure the iframe content is fully loaded
              setTimeout(() => {
                enableEditModeDirectly();
              }, 500);
              return; // Skip the normal isEditable check
            }
          }
        } catch (error) {
          console.error("Error checking sessionStorage for edit mode:", error);
        }
        
        // Check if edit mode should be enabled
        if (isEditable) {
          console.log("Edit mode should be enabled on load");
          // Use a timeout to ensure the iframe content is fully loaded
          setTimeout(() => {
            enableEditModeDirectly();
          }, 500);
        }
      };
      
      iframe.addEventListener('load', handleLoad);
      
      return () => {
        iframe.removeEventListener('load', handleLoad);
      };
    }, [isEditable]);
    
    // Listen for messages from the iframe when text is edited
    useEffect(() => {
      // Skip if onCodeUpdate callback is not provided
      if (!onCodeUpdate) {
        console.log("No onCodeUpdate callback provided");
        return;
      }
      
      const handleMessage = (event: MessageEvent) => {
        console.log("Received message from iframe:", event.data?.type);
        
        // Check if the message is from our iframe
        if (event.data && event.data.type === 'TEXT_UPDATED') {
          console.log('Received TEXT_UPDATED message from iframe in IframePreview');
          
          // Call the onCodeUpdate callback with the updated HTML
          if (event.data.html) {
            console.log("Calling onCodeUpdate with HTML");
            onCodeUpdate(event.data.html);
          }
        }
      };
      
      console.log("Adding message event listener for iframe updates");
      
      // Add event listener for messages from the iframe
      window.addEventListener('message', handleMessage);
      
      // Clean up event listener when component unmounts
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [onCodeUpdate]);
    
    // Toggle edit mode when isEditable prop changes
    useEffect(() => {
      console.log("isEditable prop changed to:", isEditable);
      
      if (!iframeLoaded) {
        console.log("Iframe not loaded yet, skipping edit mode toggle");
        return;
      }
      
      // Force a refresh of the iframe when entering edit mode
      if (isEditable) {
        console.log("Enabling edit mode directly");
        
        // Use setTimeout to ensure DOM is fully loaded
        setTimeout(() => {
          enableEditModeDirectly();
          console.log("Edit mode enabled function called");
        }, 100);
      } else if (!isEditable && editModeEnabled) {
        console.log("Disabling edit mode");
        disableEditModeDirectly();
      }
    }, [isEditable, iframeLoaded]);
    
    // Function to get safe iframe content
    const getSafeIframeContent = () => {
      if (!code) return '';
      
      try {
        // If code is a complete HTML document, use it as is
        if (code.includes('<!DOCTYPE') || code.includes('<html')) {
          return code;
        }
        
        // Otherwise, wrap it in a basic HTML structure
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
  ${code}
</body>
</html>`;
      } catch (error) {
        console.error("Error preparing iframe content:", error);
        return `<!DOCTYPE html><html><body>Error preparing content</body></html>`;
      }
    };
    
    // If there's no code, show a loading state
    if (!code) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="text-gray-500">Loading preview...</div>
        </div>
      );
    }
    
    return (
      <iframe
        ref={localIframeRef}
        className="w-full h-full border-0"
        srcDoc={getSafeIframeContent()}
        sandbox="allow-scripts allow-same-origin allow-forms"
        title="Preview"
      />
    );
  }
));

IframePreview.displayName = "IframePreview";

// Extend Window interface to include our custom properties
declare global {
  interface Window {
    _editListenerAdded?: boolean;
  }
}
