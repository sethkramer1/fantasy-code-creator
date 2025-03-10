import React, { useState, useEffect, useRef } from "react";
import { Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CodeWithLineNumbersProps {
  code: string;
  language: string;
  isEditable?: boolean;
  onCodeChange?: (code: string) => void;
}

export const CodeWithLineNumbers = ({ 
  code, 
  language, 
  isEditable = false, 
  onCodeChange 
}: CodeWithLineNumbersProps) => {
  const [editableCode, setEditableCode] = useState(code);
  const codeContainerRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Update local state when code prop changes
  useEffect(() => {
    setEditableCode(code);
  }, [code]);
  
  // Sync scroll between line numbers and code
  useEffect(() => {
    const handleCodeScroll = () => {
      if (lineNumbersRef.current && (codeContainerRef.current || textareaRef.current)) {
        const scrollContainer = isEditable ? textareaRef.current : codeContainerRef.current;
        if (scrollContainer) {
          lineNumbersRef.current.scrollTop = scrollContainer.scrollTop;
        }
      }
    };

    const scrollContainer = isEditable ? textareaRef.current : codeContainerRef.current;
    scrollContainer?.addEventListener('scroll', handleCodeScroll);
    
    return () => {
      scrollContainer?.removeEventListener('scroll', handleCodeScroll);
    };
  }, [isEditable]);
  
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
  
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setEditableCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };
  
  const lines = (isEditable ? editableCode : code).split('\n');
  
  return (
    <div className="relative flex text-xs font-mono h-full bg-white">
      <div 
        ref={lineNumbersRef}
        className="bg-gray-50 text-gray-400 pr-4 pl-3 text-right select-none border-r border-gray-200 overflow-hidden shadow-sm"
        style={{ overflowY: 'hidden', minWidth: '3.5rem' }}
      >
        {lines.map((_, i) => (
          <div key={i} className="leading-5 py-0.5 text-xs">
            {i + 1}
          </div>
        ))}
      </div>
      
      {isEditable ? (
        <textarea
          ref={textareaRef}
          value={editableCode}
          onChange={handleCodeChange}
          className="flex-1 overflow-auto pl-4 pr-8 text-gray-800 bg-white font-mono text-xs leading-5 resize-none border-none focus:outline-none focus:ring-0"
          spellCheck="false"
          style={{ 
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            overflowX: 'auto',
            caretColor: '#4f46e5'
          }}
        />
      ) : (
        <pre 
          ref={codeContainerRef}
          className="flex-1 overflow-auto pl-4 pr-8 text-gray-800 bg-white whitespace-pre text-left"
        >
          <code className={`language-${language} bg-white`}>
            {lines.map((line, i) => (
              <div key={i} className="leading-5 py-0.5">{line}</div>
            ))}
          </code>
        </pre>
      )}
      
      <button
        onClick={handleCopyCode}
        className="absolute top-3 right-3 p-1.5 bg-white hover:bg-gray-100 text-gray-500 hover:text-indigo-600 transition-all duration-200 rounded-md border border-gray-200 shadow-sm hover:shadow-md"
        title="Copy code"
      >
        <Copy size={14} />
      </button>
    </div>
  );
};
