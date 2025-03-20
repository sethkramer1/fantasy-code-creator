import { useEffect, forwardRef, useState, useImperativeHandle, useRef } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { Button } from "@/components/ui/button";
import { Edit, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import PexelsImageAttribution from "@/components/common/PexelsImageAttribution";
import { IframePreview } from "./components/IframePreview";

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
    const [hasPexelsImages, setHasPexelsImages] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    // Forward the ref
    useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement);
    
    // Process the code when currentVersion changes
    useEffect(() => {
      if (currentVersion?.code) {
        // Check if the code contains Pexels images
        setHasPexelsImages(currentVersion.code.includes('pexels.com') || 
                          currentVersion.code.includes('data-pexels-id'));
        
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
    
    // Listen for processed content events from the Pexels API
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        // Check if the message is from our expected source
        if (event.data && event.data.type === 'processed_content') {
          console.log('Received processed content with Pexels images');
          
          // Update the processed code with the new content
          setProcessedCode(event.data.content);
          setHasPexelsImages(true);
          
          // Refresh the iframe to show the new content
          setRefreshCounter(prev => prev + 1);
        }
      };
      
      // Add event listener
      window.addEventListener('message', handleMessage);
      
      // Clean up
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, []);
    
    // Toggle edit mode
    const handleEditClick = () => {
      console.log("Edit mode activated");
      setIsEditMode(true);
    };
    
    // Handle code update from IframePreview
    const handleCodeUpdate = (updatedHtml: string) => {
      console.log("Code updated from IframePreview");
      // Save the edited code
      setEditedCode(updatedHtml);
    };
    
    // Handle save
    const handleSave = () => {
      if (!currentVersion || !onSaveCode) return;
      
      try {
        // Create a new version with the updated HTML
        const newVersion = {
          ...currentVersion,
          code: editedCode || processedCode
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
      // Exit edit mode without saving
      setIsEditMode(false);
      
      // Clear edited code
      setEditedCode(null);
      
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
    
    return (
      <div className="h-full flex flex-col">
        {showCode ? (
          <CodeEditor
            html={parseCodeSections(currentVersion?.code || "").html}
            css={parseCodeSections(currentVersion?.code || "").css}
            js={parseCodeSections(currentVersion?.code || "").js}
            isOwner={isOwner}
            onSave={handleSaveCode}
          />
        ) : (
          <div className="relative h-full flex flex-col">
            {/* Edit buttons for owners */}
            {isOwner && !isEditMode && (
              <div className="absolute top-2 right-2 z-10 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditClick}
                  className="bg-white/90 hover:bg-white"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Text
                </Button>
              </div>
            )}
            
            {/* Save/Cancel buttons when in edit mode */}
            {isEditMode && (
              <div className="absolute top-2 right-2 z-10 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  className="bg-white/90 hover:bg-white"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSave}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            )}
            
            {/* Use IframePreview for better edit text support */}
            <div className="w-full h-full flex-grow">
              <IframePreview
                ref={iframeRef}
                code={processedCode}
                isEditable={isEditMode}
                onCodeUpdate={handleCodeUpdate}
              />
            </div>
            
            {/* Pexels attribution if images are used */}
            {hasPexelsImages && (
              <PexelsImageAttribution className="py-2" />
            )}
          </div>
        )}
      </div>
    );
  }
);

GamePreview.displayName = "GamePreview";
