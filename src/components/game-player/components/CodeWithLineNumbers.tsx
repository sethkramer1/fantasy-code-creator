
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
      <div className="bg-gray-800 text-gray-500 pr-4 pl-2 text-right select-none">
        {lines.map((_, i) => (
          <div key={i} className="leading-5">
            {i + 1}
          </div>
        ))}
      </div>
      <pre className="flex-1 overflow-auto pl-4 text-gray-100">
        <code className={`language-${language} whitespace-pre`}>
          {code}
        </code>
      </pre>
      <button
        onClick={handleCopyCode}
        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-white transition-colors"
        title="Copy code"
      >
        <Copy size={16} />
      </button>
    </div>
  );
};
