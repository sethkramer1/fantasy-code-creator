
import { Timer } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useEffect, useRef } from "react";

interface GenerationTerminalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  output: string[];
  thinkingTime: number;
  loading: boolean;
  asModal?: boolean;
}

export function GenerationTerminal({ 
  open, 
  onOpenChange, 
  output, 
  thinkingTime, 
  loading,
  asModal = true
}: GenerationTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Enhanced auto-scroll to bottom whenever output changes
  useEffect(() => {
    if (terminalRef.current) {
      // First approach: directly set scrollTop
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      
      // Second approach: use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      });
      
      // Third approach: use scrollIntoView on an anchor element
      if (scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    }
  }, [output]); // React to output changes

  // If asModal is false, render the terminal directly
  if (!asModal) {
    return (
      <div className="bg-black text-green-400 font-mono p-6 h-full flex flex-col overflow-hidden border border-green-500/20 rounded-lg">
        <div className="mb-4 flex-shrink-0">
          <h2 className="text-green-400 text-xl font-bold">Generation Progress</h2>
          <div className="text-green-400/70 space-y-2 mt-2">
            <div className="flex items-center gap-2">
              <Timer size={16} />
              <span>Thinking for {thinkingTime} seconds...</span>
            </div>
            <p>Watching the AI create your content in real-time...</p>
          </div>
        </div>
        <div 
          ref={terminalRef}
          className="mt-4 space-y-1 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/50 scrollbar-track-black/50 scroll-smooth max-h-[calc(100%-120px)]"
          style={{ 
            overflowY: 'auto',
            height: 'calc(100% - 120px)',
            maxHeight: 'calc(100% - 120px)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="flex-1">
            {output.map((line, index) => (
              <div key={`line-${index}-${line.substring(0, 10)}`} className="whitespace-pre-wrap py-1 break-all">
                {line}
              </div>
            ))}
          </div>
          {loading && (
            <div className="animate-pulse mt-2">
              <span className="text-green-500">_</span>
            </div>
          )}
          <div ref={scrollAnchorRef} style={{ float: 'left', clear: 'both' }}></div>
        </div>
      </div>
    );
  }

  // Render as a modal dialog
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
          style={{ 
            overflowY: 'auto',
            height: '50vh',
            maxHeight: '50vh',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="flex-1">
            {output.map((line, index) => (
              <div key={`line-${index}-${line.substring(0, 10)}`} className="whitespace-pre-wrap py-1 break-all">
                {line}
              </div>
            ))}
          </div>
          {loading && (
            <div className="animate-pulse mt-2">
              <span className="text-green-500">_</span>
            </div>
          )}
          <div ref={scrollAnchorRef} style={{ float: 'left', clear: 'both' }}></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
