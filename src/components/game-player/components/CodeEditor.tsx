
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, FileText, Pencil } from "lucide-react";
import { CodeWithLineNumbers } from "./CodeWithLineNumbers";

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
  selectedFont: string;
  onFontChange: (font: string) => void;
}

export const CodeEditor = ({ html, css, js, selectedFont }: CodeEditorProps) => {
  const [activeTab, setActiveTab] = useState<string>("html");

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
