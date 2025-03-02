
import React from "react";

interface CodeWithLineNumbersProps {
  code: string;
  language: string;
}

export const CodeWithLineNumbers = ({ code, language }: CodeWithLineNumbersProps) => {
  const lines = code.split('\n');
  
  return (
    <div className="flex text-xs font-mono">
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
    </div>
  );
};
