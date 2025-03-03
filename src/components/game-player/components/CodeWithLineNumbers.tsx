
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

  // Apply syntax highlighting classes based on token patterns
  const applyColorSyntax = (line: string) => {
    // Replace different code elements with styled spans
    return line
      // Keywords
      .replace(/\b(import|from|export|const|function|return|if|else|switch|case|break|default|for|while|let|var|class|extends|interface|type|async|await|try|catch|new|this|true|false|null|undefined)\b/g, 
        '<span class="text-purple-600">$1</span>')
      // String literals
      .replace(/(".*?"|'.*?'|`.*?`)/g, 
        '<span class="text-green-600">$1</span>')
      // Import paths  
      .replace(/from\s+(<span class="text-green-600">["'])(.*?)(<\/span>)/g,
        'from <span class="text-green-600">$2</span>')
      // Function names
      .replace(/function\s+([A-Za-z0-9_]+)/g, 
        'function <span class="text-blue-600">$1</span>')
      // Variable declarations
      .replace(/(const|let|var)\s+([A-Za-z0-9_]+)/g, 
        '$1 <span class="text-blue-600">$2</span>')
      // Comments
      .replace(/\/\/(.*?)$/g, 
        '<span class="text-gray-500">//$1</span>')
      // Parameter brackets and destructuring
      .replace(/(\{|\}|\[|\]|\(|\))/g, 
        '<span class="text-gray-500">$1</span>')
      // Arrow functions
      .replace(/=&gt;/g, 
        '<span class="text-purple-600">=&gt;</span>');
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
      <pre className="flex-1 overflow-auto pl-4 text-gray-800 bg-white">
        <code className={`language-${language} whitespace-pre bg-white`}>
          {lines.map((line, i) => (
            <div key={i} className="leading-5 py-0.5" dangerouslySetInnerHTML={{ __html: applyColorSyntax(line) }} />
          ))}
        </code>
      </pre>
      <button
        onClick={handleCopyCode}
        className="absolute top-2 right-2 p-1.5 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700 hover:text-gray-900 transition-colors"
        title="Copy code"
      >
        <Copy size={16} />
      </button>
    </div>
  );
};
