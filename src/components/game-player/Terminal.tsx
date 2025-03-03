
import React from 'react';

interface TerminalProps {
  output: string[];
  thinkingTime: number;
  generationInProgress: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({ 
  output, 
  thinkingTime,
  generationInProgress 
}) => {
  return (
    <div className="bg-black text-green-400 p-4 h-full overflow-auto font-mono text-sm">
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-white font-bold">Generation Terminal</span>
          <span className="text-gray-400">
            {thinkingTime > 0 && (
              <>Time elapsed: {thinkingTime}s</>
            )}
          </span>
        </div>
        <div className="h-px bg-gray-700 mb-2" />
      </div>
      
      <div className="space-y-1">
        {output.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap break-words">
            {line}
          </div>
        ))}
        
        {generationInProgress && (
          <div className="text-yellow-400 flex items-center mt-1">
            <span className="animate-pulse mr-1">▌</span> Thinking...
          </div>
        )}
      </div>
    </div>
  );
};
