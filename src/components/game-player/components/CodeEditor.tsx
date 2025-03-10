import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, FileText, Pencil, Save } from "lucide-react";
import { CodeWithLineNumbers } from "./CodeWithLineNumbers";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
  isOwner: boolean;
  onSave?: (html: string, css: string, js: string) => Promise<void>;
}

export const CodeEditor = ({ html, css, js, isOwner, onSave }: CodeEditorProps) => {
  const [activeTab, setActiveTab] = useState<string>("html");
  const [editableHtml, setEditableHtml] = useState(html);
  const [editableCss, setEditableCss] = useState(css);
  const [editableJs, setEditableJs] = useState(js);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update state when props change
  useEffect(() => {
    if (!isEditing) {
      setEditableHtml(html);
      setEditableCss(css);
      setEditableJs(js);
    }
  }, [html, css, js, isEditing]);

  const handleToggleEdit = () => {
    if (!isOwner) {
      toast({
        title: "Permission denied",
        description: "Only the owner can edit this design",
        variant: "destructive"
      });
      return;
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    try {
      setIsSaving(true);
      await onSave(editableHtml, editableCss, editableJs);
      setIsEditing(false);
      toast({
        title: "Changes saved",
        description: "Your changes have been saved as a new version"
      });
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({
        title: "Error saving changes",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCodeChange = (code: string) => {
    switch (activeTab) {
      case "html":
        setEditableHtml(code);
        break;
      case "css":
        setEditableCss(code);
        break;
      case "js":
        setEditableJs(code);
        break;
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col bg-white text-gray-800 border border-gray-200 shadow-md rounded-lg">
      <Tabs defaultValue="html" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <TabsList className="flex gap-1.5 bg-transparent h-10 p-1 rounded-lg border border-gray-200/80 shadow-sm">
            <TabsTrigger 
              value="html" 
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all duration-200
              data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm 
              data-[state=active]:border data-[state=active]:border-gray-200
              data-[state=inactive]:hover:bg-white/60"
            >
              <FileText size={14} className="text-indigo-600" />
              <span>index.html</span>
            </TabsTrigger>
            {css && (
              <TabsTrigger 
                value="css" 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all duration-200
                data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm 
                data-[state=active]:border data-[state=active]:border-gray-200
                data-[state=inactive]:hover:bg-white/60"
              >
                <Pencil size={14} className="text-indigo-600" />
                <span>styles.css</span>
              </TabsTrigger>
            )}
            {js && (
              <TabsTrigger 
                value="js" 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all duration-200
                data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm 
                data-[state=active]:border data-[state=active]:border-gray-200
                data-[state=inactive]:hover:bg-white/60"
              >
                <Code size={14} className="text-indigo-600" />
                <span>script.js</span>
              </TabsTrigger>
            )}
          </TabsList>
          
          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleEdit}
                  className="h-8 text-xs rounded-full bg-white shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {isEditing ? "Cancel" : "Edit Code"}
                </Button>
                
                {isEditing && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-8 text-xs rounded-full bg-green-600 hover:bg-green-700 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                    <Save size={14} className="ml-1" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <TabsContent value="html" className="m-0 h-full p-0">
            <CodeWithLineNumbers 
              code={isEditing ? editableHtml : html} 
              language="html" 
              isEditable={isEditing}
              onCodeChange={handleCodeChange}
            />
          </TabsContent>
          
          <TabsContent value="css" className="m-0 h-full p-0">
            <CodeWithLineNumbers 
              code={isEditing ? editableCss : css} 
              language="css" 
              isEditable={isEditing}
              onCodeChange={handleCodeChange}
            />
          </TabsContent>
          
          <TabsContent value="js" className="m-0 h-full p-0">
            <CodeWithLineNumbers 
              code={isEditing ? editableJs : js} 
              language="javascript" 
              isEditable={isEditing}
              onCodeChange={handleCodeChange}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
