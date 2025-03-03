
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

  // Apply syntax highlighting classes based on language and token patterns
  const applyColorSyntax = (line: string, language: string) => {
    if (language === 'html') {
      // HTML-specific syntax highlighting
      return line
        // HTML Tags with attributes: <tag attr="value">
        .replace(/(&lt;)([\/\w\-]+)(\s+[^&]*)?(&gt;)/g, 
          '<span class="text-blue-600">$1$2</span>$3<span class="text-blue-600">$4</span>')
        // HTML Attributes: attr="value"
        .replace(/(\s+)([a-zA-Z\-]+)(=)(".*?")/g, 
          '$1<span class="text-orange-500">$2</span>$3<span class="text-green-600">$4</span>')
        // DOCTYPE declaration
        .replace(/(&lt;!DOCTYPE\s+[^&]*&gt;)/g, 
          '<span class="text-gray-500">$1</span>')
        // HTML Comments: <!-- comment -->
        .replace(/(&lt;!--)(.*?)(--%&gt;)/g, 
          '<span class="text-gray-500">$1$2$3</span>');
    } else if (language === 'css') {
      // CSS-specific syntax highlighting
      return line
        // CSS Selectors
        .replace(/([a-zA-Z0-9_\-\.#:]+)(\s*\{)/g, 
          '<span class="text-purple-600">$1</span>$2')
        // CSS Properties
        .replace(/(\s+)([a-zA-Z\-]+)(\s*:)/g, 
          '$1<span class="text-blue-600">$2</span>$3')
        // CSS Values
        .replace(/(:)(\s*)([\w\d\s\.\-#%]+)(;)/g, 
          '$1$2<span class="text-green-600">$3</span>$4')
        // CSS Comments
        .replace(/(\/\*)(.*?)(\*\/)/g, 
          '<span class="text-gray-500">$1$2$3</span>');
    } else if (language === 'javascript') {
      // JavaScript-specific syntax highlighting
      return line
        // Keywords
        .replace(/\b(import|from|export|const|let|var|function|return|if|else|switch|case|break|default|for|while|class|extends|interface|type|async|await|try|catch|new|this|true|false|null|undefined)\b/g, 
          '<span class="text-purple-600">$1</span>')
        // String literals
        .replace(/(".*?"|'.*?'|`.*?`)/g, 
          '<span class="text-green-600">$1</span>')
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
          '<span class="text-purple-600">=&gt;</span>')
        // Numbers
        .replace(/\b(\d+)\b/g,
          '<span class="text-orange-400">$1</span>');
    }
    
    // Fallback for any other language or unrecognized content
    return line;
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
            <div key={i} className="leading-5 py-0.5" dangerouslySetInnerHTML={{ __html: applyColorSyntax(line, language) }} />
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
