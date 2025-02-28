import { Timer } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useEffect, useRef } from "react";

interface GenerationTerminalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  output: string[];
  thinkingTime: number;
  loading: boolean;
  asModal?: boolean; // New prop to determine if it should render as a modal
}

export function GenerationTerminal({ 
  open = true, 
  onOpenChange, 
  output, 
  thinkingTime, 
  loading,
  asModal = true // Default to modal for backward compatibility
}: GenerationTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever output changes
  useEffect(() => {
    if (terminalRef.current && open) {
      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      });
    }
  }, [output, open]);

  // Terminal content to be used in both modal and inline versions
  const terminalContent = (
    <>
      <div className="text-green-400 mb-4 font-bold text-lg">Generation Progress</div>
      <div className="text-green-400/70 space-y-2">
        <div className="flex items-center gap-2">
          <Timer size={16} />
          <span>Thinking for {thinkingTime} seconds...</span>
        </div>
        <p>Watching the AI create your content in real-time...</p>
      </div>
      <div 
        ref={terminalRef}
        className="mt-4 space-y-1 h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/50 scrollbar-track-black/50 scroll-smooth"
      >
        {output.map((line, index) => (
          <div key={`line-${index}-${line.substring(0, 10)}`} className="whitespace-pre-wrap py-1 break-all">
            {line}
          </div>
        ))}
        {loading && (
          <div className="animate-pulse mt-2">
            <span className="text-green-500">_</span>
          </div>
        )}
      </div>
    </>
  );

  // If using as modal, wrap in Dialog components
  if (asModal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-black text-green-400 font-mono p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden border border-green-500/20">
          <DialogTitle className="text-green-400 mb-4">Generation Progress</DialogTitle>
          <DialogDescription className="text-green-400/70 space-y-2">
            <div className="flex items-center gap-2">
              <Timer size={16} />
              <span>Thinking for {thinkingTime} seconds...</span>
            </div>
            <p>Watching the AI create your content in real-time...</p>
          </DialogDescription>
          <div 
            ref={terminalRef}
            className="mt-4 space-y-1 h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/50 scrollbar-track-black/50 scroll-smooth"
          >
            {output.map((line, index) => (
              <div key={`line-${index}-${line.substring(0, 10)}`} className="whitespace-pre-wrap py-1 break-all">
                {line}
              </div>
            ))}
            {loading && (
              <div className="animate-pulse mt-2">
                <span className="text-green-500">_</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Otherwise return as a regular div
  return (
    <div className="bg-black text-green-400 font-mono p-6 w-full h-full border border-green-500/20 flex flex-col">
      {terminalContent}
    </div>
  );
}
