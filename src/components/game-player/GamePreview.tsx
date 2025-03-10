import { useEffect, forwardRef, useState, useImperativeHandle, useRef } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { Button } from "@/components/ui/button";
import { Edit, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

interface GamePreviewProps {
  currentVersion: GameVersion | undefined;
  showCode: boolean;
  isOwner: boolean;
  onSaveCode?: (updatedVersion: GameVersion) => void;
}

export const GamePreview = forwardRef<HTMLIFrameElement, GamePreviewProps>(
  ({ currentVersion, showCode, isOwner, onSaveCode }, ref) => {
    const [processedCode, setProcessedCode] = useState<string>("");
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [editedCode, setEditedCode] = useState<string | null>(null);
    const [refreshCounter, setRefreshCounter] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    // Forward the ref
    useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement);
    
    // Process the code when currentVersion changes
    useEffect(() => {
      if (currentVersion?.code) {
        const { html, css, js } = parseCodeSections(currentVersion.code);
        let combinedCode = "";
        
        // If HTML includes doctype or html tag, it's a complete HTML document
        if (html.includes("<!DOCTYPE html>") || html.includes("<html")) {
          // Replace closing head tag with CSS
          if (css) {
            const styleTag = `<style>\n${css}\n</style>\n</head>`;
            combinedCode = html.replace("</head>", styleTag);
          } else {
            combinedCode = html;
          }
          
          // Replace closing body tag with JS
          if (js) {
            const scriptTag = `<script>\n${js}\n</script>\n</body>`;
            combinedCode = combinedCode.replace("</body>", scriptTag);
          }
        } else {
          // Otherwise, create a new HTML document
          combinedCode = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${css}
  </style>
</head>
<body>
${html}
<script>
${js}
</script>
</body>
</html>`;
        }
        
        setProcessedCode(combinedCode);
      }
    }, [currentVersion]);
    
    // Toggle edit mode
    const handleEditClick = () => {
      console.log("Edit mode activated");
      setIsEditMode(true);
    };
    
    // Handle iframe load, enable edit mode if needed
    const handleIframeLoad = () => {
      if (!iframeRef.current || !iframeRef.current.contentDocument) return;
      
      // Make sure any previous edit indicators are removed
      try {
        const oldIndicator = iframeRef.current.contentDocument.getElementById('edit-mode-indicator');
        if (oldIndicator) oldIndicator.remove();
      } catch (e) {
        console.error("Error removing old indicator:", e);
      }
      
      // Only proceed with edit mode if we're in edit mode
      if (!isEditMode) return;
      
      console.log("Iframe loaded, applying edit mode");
      
      try {
        // Try using document.designMode
        iframeRef.current.contentDocument.designMode = 'on';
        console.log("Enabled designMode on iframe document");
        
        // Add edit mode styles
        const style = document.createElement('style');
        style.id = 'edit-mode-styles';
        iframeRef.current.contentDocument.head.appendChild(style);
        style.textContent = `
          body {
            cursor: text;
          }
        `;
        
        // Add edit mode indicator
        const indicator = document.createElement('div');
        indicator.id = 'edit-mode-indicator';
        indicator.textContent = 'Edit Mode: Click to edit text';
        indicator.style.position = 'fixed';
        indicator.style.top = '10px';
        indicator.style.left = '10px';
        indicator.style.backgroundColor = 'rgba(255, 107, 0, 0.8)';
        indicator.style.color = 'white';
        indicator.style.padding = '8px 12px';
        indicator.style.borderRadius = '4px';
        indicator.style.zIndex = '9999';
        indicator.style.fontSize = '14px';
        iframeRef.current.contentDocument.body.appendChild(indicator);
      } catch (error) {
        console.error("Error applying edit mode:", error);
      }
    };
    
    // Handle save
    const handleSave = () => {
      if (!currentVersion || !onSaveCode || !iframeRef.current || !iframeRef.current.contentDocument) return;
      
      try {
        // Try to remove all edit mode artifacts
        try {
          // Remove edit mode indicator
          const indicator = iframeRef.current.contentDocument.getElementById('edit-mode-indicator');
          if (indicator) {
            indicator.remove();
          }
          
          // Remove edit mode styles
          const styles = iframeRef.current.contentDocument.getElementById('edit-mode-styles');
          if (styles) {
            styles.remove();
          }
          
          // Turn off design mode
          if (iframeRef.current.contentDocument.designMode === 'on') {
            iframeRef.current.contentDocument.designMode = 'off';
          }
        } catch (cleanupError) {
          console.error("Error cleaning up edit mode:", cleanupError);
        }
        
        // Get the updated HTML - do this AFTER removing edit mode UI elements
        const updatedHtml = iframeRef.current.contentDocument.documentElement.outerHTML;
        
        // Clean any edit-related attributes from the HTML
        const cleanHtml = updatedHtml
          .replace(/contenteditable="true"/g, '')
          .replace(/contenteditable=""/g, '')
          .replace(/data-editable="true"/g, '');
        
        // Save the edited code for when we exit edit mode
        setEditedCode(cleanHtml);
        
        // Create a new version with the updated HTML
        const newVersion = {
          ...currentVersion,
          code: cleanHtml
        };
        
        // Call the onSaveCode callback
        onSaveCode(newVersion);
        
        // Exit edit mode
        setIsEditMode(false);
        
        // Increment refresh counter to force iframe re-render
        setRefreshCounter(prev => prev + 1);
        
        // Show success toast
        toast({
          title: "Changes saved",
          description: "Your text changes have been saved successfully."
        });
      } catch (error) {
        console.error("Error saving changes:", error);
        toast({
          title: "Error saving changes",
          description: "There was a problem saving your changes.",
          variant: "destructive"
        });
      }
    };
    
    // Handle cancel
    const handleCancel = () => {
      // Try to remove all edit mode artifacts
      try {
        if (iframeRef.current && iframeRef.current.contentDocument) {
          // Remove edit mode indicator
          const indicator = iframeRef.current.contentDocument.getElementById('edit-mode-indicator');
          if (indicator) {
            indicator.remove();
          }
          
          // Remove edit mode styles
          const styles = iframeRef.current.contentDocument.getElementById('edit-mode-styles');
          if (styles) {
            styles.remove();
          }
          
          // Turn off design mode
          if (iframeRef.current.contentDocument.designMode === 'on') {
            iframeRef.current.contentDocument.designMode = 'off';
          }
        }
      } catch (cleanupError) {
        console.error("Error cleaning up edit mode:", cleanupError);
      }
      
      // Exit edit mode without saving
      setIsEditMode(false);
      
      // Increment refresh counter to force iframe re-render
      setRefreshCounter(prev => prev + 1);
      
      toast({
        title: "Edit cancelled",
        description: "Your changes have been discarded."
      });
    };
    
    const handleSaveCode = async (html: string, css: string, js: string) => {
      if (!onSaveCode || !currentVersion) return;
      
      try {
        // Combine the code sections
        let combinedCode = "";
        
        if (html.includes("<!DOCTYPE html>") || html.includes("<html")) {
          // It's a complete HTML document, inject CSS and JS
          if (css) {
            const styleTag = `<style>\n${css}\n</style>\n</head>`;
            combinedCode = html.replace("</head>", styleTag);
          } else {
            combinedCode = html;
          }
          
          if (js) {
            const scriptTag = `<script>\n${js}\n</script>\n</body>`;
            combinedCode = combinedCode.replace("</body>", scriptTag);
          }
        } else {
          // Create a new HTML document
          combinedCode = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${css}
  </style>
</head>
<body>
${html}
<script>
${js}
</script>
</body>
</html>`;
        }
        
        // Save the combined code
        await onSaveCode({
          ...currentVersion,
          code: combinedCode,
        });
        
        toast({
          title: "Code saved",
          description: "Your code changes have been saved successfully."
        });
      } catch (error) {
        console.error("Error saving code:", error);
        toast({
          title: "Error saving code",
          description: "There was an error saving your code changes.",
          variant: "destructive"
        });
      }
    };
    
    // Determine what HTML content to display
    const getDisplayContent = () => {
      if (isEditMode) {
        return processedCode;
      } else if (editedCode && refreshCounter > 0) {
        return editedCode;
      } else {
        return processedCode;
      }
    };
    
    return (
      <div className="h-full flex flex-col">
        {showCode ? (
          <CodeEditor
            html={parseCodeSections(currentVersion?.code || "").html}
            css={parseCodeSections(currentVersion?.code || "").css}
            js={parseCodeSections(currentVersion?.code || "").js}
            onSave={handleSaveCode}
            isOwner={isOwner}
          />
        ) : (
          <div className="h-full relative">
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              srcDoc={getDisplayContent()}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              title="Preview"
              key={`${isEditMode ? 'edit' : 'view'}-${refreshCounter}`} // Force iframe recreation
              onLoad={handleIframeLoad}
            />
            
            {/* Control buttons */}
            <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-gray-900/50 to-transparent flex justify-end z-10">
              {/* Edit button shown when not in edit mode */}
              {isOwner && !isEditMode && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleEditClick}
                  className="h-8 gap-1 bg-white/90 hover:bg-white"
                >
                  <Edit size={14} />
                  <span className="hidden sm:inline">Edit Text</span>
                </Button>
              )}
              
              {/* Save/Cancel buttons shown when in edit mode */}
              {isEditMode && (
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleCancel}
                    className="h-8 gap-1 bg-white/90 hover:bg-white text-red-600"
                  >
                    <X size={14} />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleSave}
                    className="h-8 gap-1 bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Save size={14} />
                    <span className="hidden sm:inline">Save</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

GamePreview.displayName = "GamePreview";
