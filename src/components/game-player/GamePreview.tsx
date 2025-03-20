import { useEffect, forwardRef, useState, useImperativeHandle, useRef, useCallback } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import PexelsImageAttribution from "@/components/common/PexelsImageAttribution";
import { IframePreview } from "./components/IframePreview";
import { EditableIframe } from "./components/EditableIframe";
import { extractEditedContent } from "./utils/EditableContentUtils";

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
    const [refreshCounter, setRefreshCounter] = useState(0);
    const [hasPexelsImages, setHasPexelsImages] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
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
          
          // Replace closing body tag with JavaScript
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
        
        setProcessedCode(combinedCode);
      }
    }, [currentVersion]);
    
    // Handle messages from iframe
    const handleMessage = (event: MessageEvent) => {
      // Process messages from the iframe if needed
      console.log("Message from iframe:", event.data);
    };
    
    useEffect(() => {
      // Add event listener
      window.addEventListener('message', handleMessage);
      
      // Clean up
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, []);
    
    // Enter edit mode
    const handleEnterEditMode = () => {
      setIsEditing(true);
    };
    
    // Cancel edit mode
    const handleCancelEdit = () => {
      setIsEditing(false);
      // Force iframe refresh to discard changes
      setRefreshCounter(prev => prev + 1);
    };
    
    // Save edited content
    const handleSaveEdit = async () => {
      if (!onSaveCode || !currentVersion || !iframeRef.current) return;
      
      try {
        setIsSaving(true);
        
        // Get the current HTML content from the iframe
        const iframeDoc = iframeRef.current.contentDocument;
        if (!iframeDoc) {
          throw new Error("Cannot access iframe content");
        }
        
        // Get the updated HTML content with editing artifacts removed
        const updatedHtml = extractEditedContent(iframeDoc);
        
        // First exit edit mode to ensure UI is consistent
        setIsEditing(false);
        
        // Save the updated code
        await onSaveCode({
          ...currentVersion,
          code: updatedHtml,
        });
        
        // Force iframe refresh with the new content
        setRefreshCounter(prev => prev + 1);
        
        toast({
          title: "Changes saved",
          description: "Your text changes have been saved successfully."
        });
      } catch (error) {
        console.error("Error saving edited content:", error);
        toast({
          title: "Error saving changes",
          description: "There was an error saving your text changes.",
          variant: "destructive"
        });
        
        // If saving fails, keep edit mode active
        setIsEditing(true);
      } finally {
        setIsSaving(false);
      }
    };
    
    // Ensure editing mode is properly synced with iframe state
    useEffect(() => {
      // This effect ensures that if the iframe is refreshed or reloaded,
      // the editing state is properly applied or removed
      console.log("Editing state changed:", isEditing);
    }, [isEditing, refreshCounter]);
    
    return (
      <div className="h-full flex flex-col">
        {showCode ? (
          <CodeEditor
            html={parseCodeSections(currentVersion?.code || "").html}
            css={parseCodeSections(currentVersion?.code || "").css}
            js={parseCodeSections(currentVersion?.code || "").js}
            isOwner={isOwner}
            onSave={async (html, css, js) => {
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
            }}
          />
        ) : (
          <div className="relative w-full h-full flex-grow">
            {/* Edit controls */}
            {isOwner && (
              <div className="absolute top-2 right-2 z-10 flex gap-2">
                {isEditing ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={handleEnterEditMode}
                  >
                    Edit Text
                  </Button>
                )}
              </div>
            )}
            
            {/* Use EditableIframe for editable content or IframePreview for view-only */}
            <div className="w-full h-full">
              {isEditing ? (
                <EditableIframe
                  ref={iframeRef}
                  code={processedCode}
                  isEditing={isEditing}
                  onCodeUpdate={(updatedCode) => {
                    // This can be used for real-time updates if needed
                    console.log("Code updated:", updatedCode);
                  }}
                  key={`editable-iframe-${refreshCounter}`}
                />
              ) : (
                <IframePreview
                  ref={iframeRef}
                  code={processedCode}
                  key={`iframe-${refreshCounter}`}
                />
              )}
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
