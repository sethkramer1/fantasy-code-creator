
import React from 'react';
import { ThinkingAnimation } from '@/components/game-creator/GenerationTerminal';

interface TerminalProps {
  output: string[];
  thinkingTime: number;
  generationInProgress: boolean;
}

export function Terminal({ output, thinkingTime, generationInProgress }: TerminalProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  const formatThinkingTime = () => {
    const minutes = Math.floor(thinkingTime / 60);
    const seconds = thinkingTime % 60;
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
          {generationInProgress && <ThinkingAnimation />}
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
