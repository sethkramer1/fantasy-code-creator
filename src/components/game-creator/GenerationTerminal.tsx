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

    if (shouldAutoScroll || loading) {
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
  }, [output, loading, thinkingTime]); // React to output changes, loading state, and thinking time

  // Process output lines to better format code blocks and highlight thinking
  const processedOutput = output.map(line => {
    // Check if line is a thinking output
    if (line.startsWith('> Thinking:')) {
      // Add some styling to thinking lines
      return line.replace('> Thinking:', '> 🤔 Thinking:');
    }
    // Check if line starts with "> " (code output indicator)
    else if (line.startsWith('> ')) {
      // Remove the prefix for display - except for tokens, errors, and other system messages
      if (line.includes('Error:') ||
          line.includes('Starting') ||
          line.includes('Generation') ||
          line.includes('Stream')) {
        return line;
      }
      return line.slice(2);
    }
    return line;
  });

  const terminalContent = (
    <>
      <div className="mb-4 flex-shrink-0">
        <div className="text-green-400/70 space-y-2">
          <div className="flex items-center gap-2">
            <Timer size={16} />
            <span>Thinking for {thinkingTime} seconds...</span>
          </div>
          <p className="text-left">Watching the AI create your content in real-time...</p>
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
          <div className="whitespace-pre-wrap py-1 break-words text-left">
            {processedOutput.map((line, index) => {
              // Highlight thinking lines
              if (line.includes('🤔 Thinking:')) {
                return (
                  <div key={index} className="text-yellow-400 font-medium py-1">
                    {line}
                  </div>
                );
              }
              // Highlight status information
              else if (line.includes('Starting') || 
                      line.includes('Generation') ||
                      line.includes('Stream')) {
                return (
                  <div key={index} className="text-green-300 italic py-1">
                    {line}
                  </div>
                );
              }
              // Highlight errors
              else if (line.includes('Error:')) {
                return (
                  <div key={index} className="text-red-400 font-bold py-1">
                    {line}
                  </div>
                );
              }
              return <div key={index} className="py-1">{line}</div>;
            })}
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
      <div className="bg-black text-green-400 font-mono p-6 pt-28 flex flex-col overflow-hidden border border-green-500/20 h-full w-full" 
           style={{ maxHeight: "100vh" }}>
        {terminalContent}
      </div>
    );
  }

  // Render as a modal dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black text-green-400 font-mono p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden border border-green-500/20 rounded-none">
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
            <div className="whitespace-pre-wrap py-1 break-words text-left">
              {processedOutput.map((line, index) => {
                // Highlight thinking lines
                if (line.includes('🤔 Thinking:')) {
                  return (
                    <div key={index} className="text-yellow-400 font-medium py-1">
                      {line}
                    </div>
                  );
                }
                // Highlight status information
                else if (line.includes('Starting') || 
                        line.includes('Generation') ||
                        line.includes('Stream')) {
                  return (
                    <div key={index} className="text-green-300 italic py-1">
                      {line}
                    </div>
                  );
                }
                // Highlight errors
                else if (line.includes('Error:')) {
                  return (
                    <div key={index} className="text-red-400 font-bold py-1">
                      {line}
                    </div>
                  );
                }
                return <div key={index} className="py-1">{line}</div>;
              })}
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
