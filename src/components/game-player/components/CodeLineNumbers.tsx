
import React from 'react';

interface CodeLineNumbersProps {
  code: string;
}

export const CodeLineNumbers: React.FC<CodeLineNumbersProps> = ({ code }) => {
  const lineCount = (code.match(/\n/g) || []).length + 1;
  
  return (
    <div className="text-gray-400 text-xs pr-4 text-right select-none border-r border-gray-200 mr-4">
      {Array.from({ length: lineCount }, (_, i) => (
        <div key={i + 1} className="h-6 leading-6">
          {i + 1}
        </div>
      ))}
    </div>
  );
};
