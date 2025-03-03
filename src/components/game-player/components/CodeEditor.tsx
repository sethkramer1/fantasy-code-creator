
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, FileText, Pencil } from "lucide-react";
import { CodeWithLineNumbers } from "./CodeWithLineNumbers";

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
}

export const CodeEditor = ({ html, css, js }: CodeEditorProps) => {
  const [activeTab, setActiveTab] = useState<string>("html");

  return (
    <div className="absolute inset-0 overflow-hidden flex flex-col bg-white text-gray-800 rounded-lg border border-gray-200 shadow-sm">
      <Tabs 
        defaultValue="html" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex items-center px-2 bg-gray-50 border-b border-gray-200">
          <TabsList className="flex gap-1 bg-transparent h-10">
            <TabsTrigger 
              value="html" 
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-white data-[state=active]:text-gray-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200"
            >
              <FileText size={14} />
              <span>index.html</span>
            </TabsTrigger>
            {css && (
              <TabsTrigger 
                value="css" 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-white data-[state=active]:text-gray-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200"
              >
                <Pencil size={14} />
                <span>styles.css</span>
              </TabsTrigger>
            )}
            {js && (
              <TabsTrigger 
                value="js" 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-white data-[state=active]:text-gray-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-gray-200"
              >
                <Code size={14} />
                <span>script.js</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        
        <div className="flex-1 overflow-auto">
          <TabsContent value="html" className="m-0 h-full p-0">
            <CodeWithLineNumbers code={html} language="html" />
          </TabsContent>
          
          <TabsContent value="css" className="m-0 h-full p-0">
            <CodeWithLineNumbers code={css} language="css" />
          </TabsContent>
          
          <TabsContent value="js" className="m-0 h-full p-0">
            <CodeWithLineNumbers code={js} language="javascript" />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
