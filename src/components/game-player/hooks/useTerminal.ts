
import { useState, useRef, useEffect } from "react";

export function useTerminal(initialGenerating: boolean) {
  const [showGenerating, setShowGenerating] = useState(initialGenerating);
  const [generationInProgress, setGenerationInProgress] = useState(initialGenerating);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "> Starting generation process...", 
    "> Creating your design based on your prompt..."
  ]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const thinkingTimerRef = useRef<NodeJS.Timeout>();
  const lastOutputRef = useRef<string>('');

  useEffect(() => {
    if (generationInProgress) {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
      
      thinkingTimerRef.current = setInterval(() => {
        setThinkingTime(prev => {
          const newTime = prev + 1;
          return newTime;
        });
      }, 1000);
    } else {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    }
    
    return () => {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    };
  }, [generationInProgress]);

  const updateTerminalOutput = (newContent: string, isNewMessage = false) => {
    setTerminalOutput(prev => {
      if (isNewMessage || 
          newContent.startsWith("> Thinking:") || 
          newContent.startsWith("> Generation") || 
          newContent.includes("completed") || 
          newContent.includes("Error:")) {
        lastOutputRef.current = newContent;
        return [...prev, newContent];
      }
      
      if (prev.length > 0) {
        const lastLine = prev[prev.length - 1];
        
        if (lastLine.startsWith("> ") && !lastLine.startsWith("> Thinking:") && 
            newContent.startsWith("> ") && !newContent.startsWith("> Thinking:")) {
          const updatedLastLine = lastLine + newContent.slice(1);
          lastOutputRef.current = updatedLastLine;
          return [...prev.slice(0, -1), updatedLastLine];
        }
      }
      
      lastOutputRef.current = newContent;
      return [...prev, newContent];
    });
  };

  const handleTerminalStatusChange = (showing: boolean, output: string[], thinking: number, isLoading: boolean) => {
    if (showing) {
      setShowGenerating(true);
      setGenerationInProgress(isLoading);
      setTerminalOutput(output);
      setThinkingTime(thinking);
    } else {
      setShowGenerating(false);
      setGenerationInProgress(false);
    }
  };

  return {
    showGenerating,
    setShowGenerating,
    generationInProgress,
    setGenerationInProgress,
    terminalOutput,
    setTerminalOutput,
    thinkingTime,
    setThinkingTime,
    updateTerminalOutput,
    handleTerminalStatusChange
  };
}
