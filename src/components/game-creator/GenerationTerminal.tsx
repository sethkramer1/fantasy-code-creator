
import { Timer } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useEffect, useRef } from "react";

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
  loading 
}: GenerationTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black text-green-400 font-mono p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden border border-green-500/20">
        <DialogTitle className="text-green-400 mb-4">Game Generation Progress</DialogTitle>
        <DialogDescription className="text-green-400/70 space-y-2">
          <div className="flex items-center gap-2">
            <Timer size={16} />
            <span>Thinking for {thinkingTime} seconds...</span>
          </div>
          <p>Watching the AI create your game in real-time...</p>
        </DialogDescription>
        <div 
          ref={terminalRef}
          className="mt-4 space-y-1 h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/50 scrollbar-track-black/50 scroll-smooth"
        >
          {output.map((line, index) => (
            <div key={index} className="whitespace-pre-wrap py-1">
              {line}
            </div>
          ))}
          {loading && (
            <div className="animate-pulse mt-2">_</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
