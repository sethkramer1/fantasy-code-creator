
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
      
      // When generation is complete, ensure we transition to showing the iframe
      if (showGenerating) {
        console.log("Generation complete, transitioning to iframe view...");
        setTimeout(() => {
          setShowGenerating(false);
        }, 1500);
      }
    }
    
    return () => {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    };
  }, [generationInProgress, showGenerating]);

  const updateTerminalOutput = (newContent: string) => {
    setTerminalOutput(prev => [...prev, newContent]);
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
