
import { useState, useEffect, forwardRef } from "react";
import { parseCodeSections } from "./utils/CodeParser";
import { CodeEditor } from "./components/CodeEditor";
import { IframePreview } from "./components/IframePreview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Type } from "lucide-react";

// Define font options with display names and CSS values
const fontOptions = [
  { name: "Consolas", value: "Consolas, monospace" },
  { name: "Fira Code", value: "'Fira Code', monospace" },
  { name: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { name: "Source Code Pro", value: "'Source Code Pro', monospace" },
  { name: "Roboto Mono", value: "'Roboto Mono', monospace" },
  { name: "Ubuntu Mono", value: "'Ubuntu Mono', monospace" },
  { name: "Monaco", value: "Monaco, monospace" },
  { name: "Menlo", value: "Menlo, monospace" },
  { name: "Courier New", value: "'Courier New', monospace" },
  { name: "Courier Prime", value: "'Courier Prime', monospace" },
  { name: "IBM Plex Mono", value: "'IBM Plex Mono', monospace" },
  { name: "Hack", value: "Hack, monospace" },
  { name: "Inconsolata", value: "Inconsolata, monospace" },
  { name: "Anonymous Pro", value: "'Anonymous Pro', monospace" },
  { name: "PT Mono", value: "'PT Mono', monospace" },
];

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
}

export const GamePreview = forwardRef<HTMLIFrameElement, GamePreviewProps>(
  ({ currentVersion, showCode }, ref) => {
    const [selectedFont, setSelectedFont] = useState<string>(fontOptions[0].value);

    useEffect(() => {
      console.log("GamePreview received currentVersion update", currentVersion?.id);
    }, [currentVersion]);

    const handleFontChange = (value: string) => {
      console.log("Font changed to:", value);
      setSelectedFont(value);
    };

    // Handle case when no version is available yet
    if (!currentVersion) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading content...</p>
        </div>
      );
    }

    if (!showCode) {
      return (
        <div className="h-full relative">
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-gray-800/70 backdrop-blur-sm rounded-md px-2 py-1">
            <Type size={14} className="text-gray-300" />
            <Select value={selectedFont} onValueChange={handleFontChange}>
              <SelectTrigger className="h-7 w-40 bg-gray-700/90 border-gray-600 text-xs text-white">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {fontOptions.map((font) => (
                  <SelectItem 
                    key={font.value} 
                    value={font.value}
                    className="text-xs"
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <IframePreview 
            code={currentVersion.code || ""} 
            ref={ref}
            selectedFont={selectedFont}
          />
        </div>
      );
    } else {
      const { html, css, js } = parseCodeSections(currentVersion.code || "");
      
      return (
        <div className="h-full relative">
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-gray-800/70 backdrop-blur-sm rounded-md px-2 py-1">
            <Type size={14} className="text-gray-300" />
            <Select value={selectedFont} onValueChange={handleFontChange}>
              <SelectTrigger className="h-7 w-40 bg-gray-700/90 border-gray-600 text-xs text-white">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {fontOptions.map((font) => (
                  <SelectItem 
                    key={font.value} 
                    value={font.value}
                    className="text-xs"
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CodeEditor 
            html={html} 
            css={css} 
            js={js} 
            selectedFont={selectedFont}
            onFontChange={handleFontChange}
          />
        </div>
      );
    }
  }
);

GamePreview.displayName = "GamePreview";
