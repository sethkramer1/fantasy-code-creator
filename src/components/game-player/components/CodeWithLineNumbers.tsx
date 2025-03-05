import React from "react";
import { Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CodeWithLineNumbersProps {
  code: string;
  language: string;
}

export const CodeWithLineNumbers = ({ code, language }: CodeWithLineNumbersProps) => {
  const lines = code.split('\n');
  
  const handleCopyCode = () => {
    navigator.clipboard.writeText(code)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "Code has been copied to your clipboard"
        });
      })
      .catch((err) => {
        console.error("Failed to copy code:", err);
        toast({
          title: "Failed to copy",
          description: "Could not copy code to clipboard",
          variant: "destructive"
        });
      });
  };
  
  return (
    <div className="relative flex text-xs font-mono">
      <div className="bg-gray-100 text-gray-500 pr-4 pl-2 text-right select-none border-r border-gray-200">
        {lines.map((_, i) => (
          <div key={i} className="leading-5 py-0.5">
            {i + 1}
          </div>
        ))}
      </div>
      <pre className="flex-1 overflow-auto pl-4 pr-4 text-gray-800 bg-white whitespace-pre-wrap text-left">
        <code className={`language-${language} bg-white`}>
          {lines.map((line, i) => (
            <div key={i} className="leading-5 py-0.5">{line}</div>
          ))}
        </code>
      </pre>
      <button
        onClick={handleCopyCode}
        className="absolute top-2 right-2 p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 hover:text-gray-900 transition-colors"
        title="Copy code"
      >
        <Copy size={16} />
      </button>
    </div>
  );
};
