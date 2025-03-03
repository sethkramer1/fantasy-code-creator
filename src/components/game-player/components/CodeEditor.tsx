
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, FileText, Pencil, Type } from "lucide-react";
import { CodeWithLineNumbers } from "./CodeWithLineNumbers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
}

export const CodeEditor = ({ html, css, js }: CodeEditorProps) => {
  const [activeTab, setActiveTab] = useState<string>("html");
  const [selectedFont, setSelectedFont] = useState<string>(fontOptions[0].value);

  const handleFontChange = (value: string) => {
    setSelectedFont(value);
  };

  return (
    <div className="absolute inset-0 overflow-hidden flex flex-col bg-gray-900 text-white rounded-lg">
      <Tabs 
        defaultValue="html" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-2 bg-gray-800 border-b border-gray-700">
          <TabsList className="flex gap-1 bg-transparent h-10">
            <TabsTrigger 
              value="html" 
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <FileText size={14} />
              <span>index.html</span>
            </TabsTrigger>
            {css && (
              <TabsTrigger 
                value="css" 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-gray-700 data-[state=active]:text-white"
              >
                <Pencil size={14} />
                <span>styles.css</span>
              </TabsTrigger>
            )}
            {js && (
              <TabsTrigger 
                value="js" 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-gray-700 data-[state=active]:text-white"
              >
                <Code size={14} />
                <span>script.js</span>
              </TabsTrigger>
            )}
          </TabsList>
          
          <div className="flex items-center mr-2">
            <div className="flex items-center gap-2">
              <Type size={14} className="text-gray-400" />
              <Select value={selectedFont} onValueChange={handleFontChange}>
                <SelectTrigger className="h-7 w-40 bg-gray-700 border-gray-600 text-xs">
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
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <TabsContent value="html" className="m-0 h-full p-0">
            <CodeWithLineNumbers code={html} language="html" fontFamily={selectedFont} />
          </TabsContent>
          
          <TabsContent value="css" className="m-0 h-full p-0">
            <CodeWithLineNumbers code={css} language="css" fontFamily={selectedFont} />
          </TabsContent>
          
          <TabsContent value="js" className="m-0 h-full p-0">
            <CodeWithLineNumbers code={js} language="javascript" fontFamily={selectedFont} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
