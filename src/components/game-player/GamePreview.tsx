import { useEffect, forwardRef, useState, useCallback, useRef, memo } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
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
      } catch (error) {
        console.error("Error processing code:", error);
        setProcessedCode(null);
      }
    }, [currentVersion, isValidCode]);
    
    const handleSaveCode = async (html: string, css: string, js: string) => {
      if (!onSaveCode) return;
      
      try {
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
      } catch (error) {
        console.error("Error saving code:", error);
        throw error;
      }
    };
    
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
          <MemoizedIframePreview 
            code={processedCode} 
            ref={ref} 
          />
        )}
      </div>
    );
  }
);

GamePreview.displayName = "GamePreview";
