import { useEffect, forwardRef, useState, useCallback, useRef, memo } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { IframePreview } from "./components/IframePreview";
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
  onSaveCode?: (code: string, instructions: string) => Promise<void>;
}

// Create a memoized version to prevent unnecessary rerenders
const MemoizedIframePreview = memo(IframePreview);

export const GamePreview = forwardRef<HTMLIFrameElement, GamePreviewProps>(
  ({ currentVersion, showCode, isOwner, onSaveCode }, ref) => {
    const [processedCode, setProcessedCode] = useState<string | null>(null);
    const currentVersionIdRef = useRef<string | null>(null);
    const [parsedHtml, setParsedHtml] = useState<string>("");
    const [parsedCss, setParsedCss] = useState<string>("");
    const [parsedJs, setParsedJs] = useState<string>("");
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    
    // Force re-render when isOwner changes
    useEffect(() => {
      console.log("GamePreview: isOwner changed to", isOwner);
    }, [isOwner]);
    
    // Log state changes for debugging
    useEffect(() => {
      console.log("GamePreview state:", { 
        hasCurrentVersion: !!currentVersion,
        versionId: currentVersion?.id,
        isOwner,
        isEditMode,
        onSaveCode: !!onSaveCode,
        showCode
      });
    }, [currentVersion, isOwner, isEditMode, onSaveCode, showCode]);
    
    // Validate code function
    const isValidCode = useCallback((code: string | undefined): boolean => {
      if (!code) return false;
      if (code === "Generating...") return false;
      if (code.length < 100) return false;
      
      const hasHtmlStructure = 
        code.includes("<html") || 
        code.includes("<!DOCTYPE") || 
        code.includes("<svg");
        
      return hasHtmlStructure;
    }, []);
    
    // Process the code only when version changes
    useEffect(() => {
      // Skip if no version is available
      if (!currentVersion?.code || !currentVersion?.id) {
        return;
      }
      
      // Skip if this version has already been processed
      if (currentVersionIdRef.current === currentVersion.id && processedCode) {
        return;
      }
      
      currentVersionIdRef.current = currentVersion.id;
      
      try {
        // Check if the code is valid
        if (!isValidCode(currentVersion.code)) {
          console.warn("Invalid code format detected");
          setProcessedCode(null);
          return;
        }
        
        // Set the processed code
        setProcessedCode(currentVersion.code);
        
        // Parse code sections
        const { html, css, js } = parseCodeSections(currentVersion.code);
        setParsedHtml(html);
        setParsedCss(css);
        setParsedJs(js);
        
        // Reset unsaved changes flag and edit mode when loading a new version
        setHasUnsavedChanges(false);
        setIsEditMode(false);
      } catch (error) {
        console.error("Error processing code:", error);
        setProcessedCode(null);
      }
    }, [currentVersion, isValidCode]);
    
    // Handle code updates from the iframe preview
    const handleIframeCodeUpdate = useCallback((updatedCode: string) => {
      console.log("Received code update from iframe");
      setProcessedCode(updatedCode);
      setHasUnsavedChanges(true);
    }, []);
    
    // Listen for TEXT_UPDATED messages from the iframe
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'TEXT_UPDATED') {
          console.log("Received TEXT_UPDATED message in GamePreview");
          handleIframeCodeUpdate(event.data.html);
        }
      };
      
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [handleIframeCodeUpdate]);
    
    // Toggle edit mode
    const toggleEditMode = useCallback(() => {
      console.log("Toggle edit mode called, current state:", isEditMode, "isOwner:", isOwner);
      if (isEditMode) {
        // Turning off edit mode
        if (hasUnsavedChanges) {
          const confirmed = window.confirm("You have unsaved changes. Are you sure you want to exit edit mode?");
          if (!confirmed) {
            return; // Keep edit mode on if user cancels
          }
        }
        console.log("Setting edit mode to FALSE");
        setIsEditMode(false);
      } else {
        // Turning on edit mode
        console.log("Setting edit mode to TRUE");
        setIsEditMode(true);
      }
    }, [isEditMode, hasUnsavedChanges, isOwner]);
    
    // Handle saving code changes
    const handleSaveChanges = useCallback(async () => {
      if (!onSaveCode || !processedCode) {
        console.error("Cannot save: onSaveCode or processedCode is missing");
        return;
      }
      
      try {
        setIsSaving(true);
        console.log("Saving changes...");
        
        // Extract instructions from the current version or use empty string
        const instructions = currentVersion?.instructions || "";
        
        // Call the onSaveCode prop with the updated code
        await onSaveCode(processedCode, instructions);
        
        // Reset state after successful save
        setHasUnsavedChanges(false);
        setIsEditMode(false);
        
        toast({
          title: "Changes saved",
          description: "Your changes have been saved successfully.",
          variant: "default",
        });
      } catch (error) {
        console.error("Error saving changes:", error);
        toast({
          title: "Error saving changes",
          description: "There was an error saving your changes. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    }, [onSaveCode, processedCode, currentVersion]);
    
    const handleSaveCode = async (html: string, css: string, js: string) => {
      if (!onSaveCode) return;
      
      try {
        setIsSaving(true);
        
        // Combine the code sections
        let combinedCode = "";
        
        if (html.includes("<!DOCTYPE") || html.includes("<html")) {
          // If HTML includes doctype or html tag, it's a complete HTML document
          // We need to inject CSS and JS into it
          
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
        
        // Save the combined code
        await onSaveCode(combinedCode, currentVersion?.instructions || "");
        
        // Reset unsaved changes flag
        setHasUnsavedChanges(false);
        
        // Show success message
        toast({
          title: "Changes saved",
          description: "Your code changes have been saved successfully",
        });
      } catch (error) {
        console.error("Error saving code:", error);
        
        // Show error message
        toast({
          title: "Error saving changes",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive"
        });
        
        throw error;
      } finally {
        setIsSaving(false);
      }
    };
    
    // Forward the ref
    useEffect(() => {
      if (ref && typeof ref === 'object') {
        ref.current = iframeRef.current;
      }
    }, [ref]);
    
    return (
      <div className="h-full relative">
        {showCode ? (
          <CodeEditor 
            html={parsedHtml} 
            css={parsedCss} 
            js={parsedJs}
            isOwner={isOwner}
            onSave={handleSaveCode}
          />
        ) : (
          <div className="h-full relative">
            <MemoizedIframePreview 
              code={processedCode} 
              ref={iframeRef}
              isEditable={isEditMode}
              onCodeUpdate={handleIframeCodeUpdate}
            />
            
            {isOwner && (
              <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-gray-900/50 to-transparent flex justify-end z-10">
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges && (
                    <div className="text-xs text-white bg-amber-500 px-2 py-1 rounded-sm animate-pulse">
                      Unsaved changes
                    </div>
                  )}
                  
                  {isEditMode ? (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={toggleEditMode}
                        className="h-8 gap-1"
                        disabled={isSaving}
                      >
                        <X size={14} />
                        <span className="hidden sm:inline">Cancel</span>
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="default"
                        onClick={handleSaveChanges}
                        className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                        disabled={!hasUnsavedChanges || isSaving}
                      >
                        {isSaving ? (
                          <>
                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-1" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save size={14} />
                            <span className="hidden sm:inline">Save Changes</span>
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        console.log("Edit Text button clicked, isOwner:", isOwner);
                        // Force a re-render by setting state directly
                        setIsEditMode(true);
                        
                        // Try to directly access the iframe and make elements editable after a short delay
                        setTimeout(() => {
                          try {
                            const iframe = iframeRef.current;
                            if (iframe && iframe.contentDocument) {
                              console.log("Attempting to directly make elements editable");
                              const textElements = iframe.contentDocument.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a, button, li, td, th, label');
                              console.log("Found", textElements.length, "text elements to make editable");
                              
                              let editableCount = 0;
                              textElements.forEach(el => {
                                if (!el.textContent || el.textContent.trim() === '') return;
                                if (el.querySelector('img, video, iframe, canvas, svg')) return;
                                
                                try {
                                  (el as HTMLElement).contentEditable = 'true';
                                  el.setAttribute('data-editable', 'true');
                                  editableCount++;
                                } catch (err) {
                                  console.error("Error making element editable:", err);
                                }
                              });
                              
                              console.log("Made", editableCount, "elements editable directly from GamePreview");
                            }
                          } catch (error) {
                            console.error("Error directly enabling edit mode from GamePreview:", error);
                          }
                        }, 300);
                      }}
                      className="h-8 gap-1 bg-white/90 hover:bg-white"
                    >
                      <Edit size={14} />
                      <span className="hidden sm:inline">Edit Text</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {isOwner && isEditMode && (
              <div className="absolute bottom-4 left-4 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-10 pointer-events-none">
                Click on any text to edit
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

GamePreview.displayName = "GamePreview";
