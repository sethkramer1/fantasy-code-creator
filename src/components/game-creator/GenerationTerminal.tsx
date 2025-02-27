
import React, { useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Loader2 } from "lucide-react";
import { SnakeGame } from "./SnakeGame";

interface GenerationTerminalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  output: string[];
  thinkingTime: number;
  loading: boolean;
}

export function GenerationTerminal({
  open,
  onOpenChange,
  output,
  thinkingTime,
  loading,
}: GenerationTerminalProps) {
  const outputContainerRef = useRef<HTMLDivElement>(null);
  
  // Format thinking time nicely
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputContainerRef.current && loading) {
      const container = outputContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [output, loading]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full sm:max-h-[80vh] max-h-[90vh] h-[90vh] p-0">
        <DialogHeader className="px-6 pt-4 border-b pb-4">
          <DialogTitle>
            Generation {loading ? "in progress" : "complete"}
            {loading && (
              <span className="ml-4 text-sm font-normal text-gray-500">
                Thinking for {formatTime(thinkingTime)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col md:flex-row h-full overflow-hidden">
          {/* Terminal Output */}
          <div 
            ref={outputContainerRef} 
            className="flex-1 overflow-y-auto p-5 md:min-w-[500px]"
          >
            <div className="font-mono text-sm">
              {output.map((line, i) => (
                <div key={i} className="mb-1">
                  {line === "" ? <br /> : line}
                </div>
              ))}
              
              {loading && (
                <div className="animate-pulse flex items-center gap-2 text-gray-500 mt-2">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Generating...</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Snake Game */}
          <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-200 p-5 overflow-y-auto flex justify-center items-start">
            <SnakeGame />
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {loading ? "Minimize" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
