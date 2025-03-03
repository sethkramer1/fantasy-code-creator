
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
  const previousOutputLength = useRef<number>(0);

  // Enhanced auto-scroll to bottom whenever output changes
  useEffect(() => {
    // Only auto-scroll if content is actually added (not on initial render)
    const shouldAutoScroll = output.length > previousOutputLength.current;
    previousOutputLength.current = output.length;

    const scrollToBottom = () => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
      
      if (scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    };

    if (shouldAutoScroll) {
      // Immediate scroll
      scrollToBottom();
      
      // Delayed scroll for when DOM updates take time
      setTimeout(scrollToBottom, 10);
      setTimeout(scrollToBottom, 100);
      
      // Final scroll with animation frame
      requestAnimationFrame(() => {
        scrollToBottom();
        requestAnimationFrame(scrollToBottom);
      });
    }
  }, [output]); // React to output changes

  // Process output lines to better format code blocks
  const processedOutput = output.map(line => {
    // Check if line starts with "> " (code output indicator)
    if (line.startsWith('> ')) {
      // Remove the prefix for display
      return line.slice(2);
    }
    return line;
  });

  const terminalContent = (
    <>
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
      
      {/* Terminal output container with flex-1 to take remaining space */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div 
          ref={terminalRef}
          className="w-full h-full overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/50 scrollbar-track-black/50 pr-2"
          style={{ 
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          <div className="whitespace-pre-wrap py-1 break-all">
            {processedOutput.join('\n')}
          </div>
          
          {loading && (
            <div className="animate-pulse mt-2">
              <span className="text-green-500">_</span>
            </div>
          )}
          
          {/* Scroll anchor */}
          <div ref={scrollAnchorRef} />
        </div>
      </div>
    </>
  );

  // If asModal is false, render the terminal directly
  if (!asModal) {
    return (
      <div className="bg-black text-green-400 font-mono p-6 flex flex-col overflow-hidden border border-green-500/20 rounded-lg h-full" 
           style={{ maxHeight: "70vh" }}>
        {terminalContent}
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
        
        <div className="h-[50vh] overflow-hidden">
          <div 
            ref={terminalRef}
            className="h-full w-full overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/50 scrollbar-track-black/50 pr-2"
          >
            <div className="whitespace-pre-wrap py-1 break-all">
              {processedOutput.join('\n')}
            </div>
            
            {loading && (
              <div className="animate-pulse mt-2">
                <span className="text-green-500">_</span>
              </div>
            )}
            
            {/* Scroll anchor */}
            <div ref={scrollAnchorRef} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
