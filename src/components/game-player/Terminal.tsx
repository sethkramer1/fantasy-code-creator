
import React from 'react';

interface TerminalProps {
  output: string[];
  thinkingTime?: number;
  thinkingProgress?: number;  // Add support for both thinkingTime and thinkingProgress
  generationInProgress?: boolean;
  isLoading?: boolean;  // Add support for isLoading prop
}

export function Terminal({ 
  output, 
  thinkingTime = 0, 
  thinkingProgress, 
  generationInProgress = false,
  isLoading = false
}: TerminalProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  // Use thinkingProgress if provided, otherwise use thinkingTime
  const displayTime = thinkingProgress !== undefined ? thinkingProgress : thinkingTime;

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  const formatThinkingTime = () => {
    const minutes = Math.floor(displayTime / 60);
    const seconds = displayTime % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="bg-black text-white h-full flex flex-col p-4 overflow-hidden font-mono">
      <div className="text-xs mb-4 flex justify-between">
        <div>Generating your design...</div>
        <div className="flex items-center gap-2">
          <span>
            Thinking time: {formatThinkingTime()}
          </span>
          {(generationInProgress || isLoading) && (
            <div className="animate-pulse">
              <span className="text-green-500">_</span>
            </div>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
      >
        {output.map((line, i) => (
          <pre key={i} className="text-xs whitespace-pre-wrap mb-1">
            {line}
          </pre>
        ))}
      </div>
    </div>
  );
}
