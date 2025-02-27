
import { Game } from "@/types/game";
import { Loader2, Code, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import html2canvas from "html2canvas";
import { useToast } from "@/components/ui/use-toast";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  onGameClick: (gameId: string) => void;
}

export function GamesList({
  games,
  isLoading,
  onGameClick
}: GamesListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useToast();

  // Helper function to download game as PNG
  const downloadGameAsImage = async (game: Game, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the game
    
    if (!game.code) {
      toast({
        title: "Cannot download",
        description: "This game doesn't have any code to render",
        variant: "destructive"
      });
      return;
    }

    try {
      setDownloadingId(game.id);

      // Create a temporary iframe to render the code
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '1200px';
      iframe.style.height = '100vh'; // Make it full viewport height initially
      iframe.style.border = 'none';
      iframe.style.zIndex = '-1000';
      iframe.style.opacity = '0';
      
      document.body.appendChild(iframe);
      
      // Wait for iframe to load
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        
        // Write content to iframe
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(game.code as string);
          doc.close();
        }
      });

      // Let content render for a moment
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capture iframe content
      if (iframe.contentDocument?.body) {
        // Get actual content height
        const contentHeight = Math.max(
          iframe.contentDocument.body.scrollHeight,
          iframe.contentDocument.documentElement.scrollHeight,
          iframe.contentDocument.body.offsetHeight,
          iframe.contentDocument.documentElement.offsetHeight
        );
        
        // Update iframe height to match content
        iframe.style.height = `${contentHeight}px`;
        
        // Create canvas with appropriate dimensions
        const canvas = await html2canvas(iframe.contentDocument.body, {
          width: 1200,
          height: contentHeight,
          windowWidth: 1200,
          windowHeight: contentHeight,
          scale: 2, // Increased from 1 to 2 for higher quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false, // Disable logging for cleaner console
          imageTimeout: 0, // No timeout for image loading
          onclone: (clonedDoc) => {
            // Ensure all styles are applied in the cloned document
            const styles = Array.from(document.styleSheets);
            styles.forEach(styleSheet => {
              try {
                const rules = Array.from(styleSheet.cssRules || []);
                const style = clonedDoc.createElement('style');
                rules.forEach(rule => style.appendChild(document.createTextNode(rule.cssText)));
                clonedDoc.head.appendChild(style);
              } catch (e) {
                // Ignore cross-origin stylesheet errors
              }
            });
          }
        });
        
        // Convert canvas to data URL with maximum quality
        const imageUrl = canvas.toDataURL('image/png', 1.0);
        
        // Create download link
        const link = document.createElement('a');
        link.download = `game-${game.id.slice(0, 8)}.png`;
        link.href = imageUrl;
        link.click();
        
        toast({
          title: "Image downloaded",
          description: "Your game screenshot has been downloaded as PNG"
        });
      }
      
      // Clean up
      document.body.removeChild(iframe);
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Could not generate image",
        variant: "destructive"
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-medium text-gray-900 mb-6">My History</h2>
      {isLoading ? <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div> : games.length > 0 ? <div className="grid gap-4 md:grid-cols-2">
          {games.map(game => <div key={game.id} className="rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-all text-left group relative">
              <button 
                onClick={() => onGameClick(game.id)} 
                className="p-4 w-full text-left"
              >
                <p className="font-medium text-gray-700 group-hover:text-black transition-colors line-clamp-2">
                  {game.prompt}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {new Date(game.created_at).toLocaleDateString()}
                </p>
              </button>
              <div className="absolute top-3 right-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="opacity-70 hover:opacity-100 bg-white"
                  onClick={(e) => downloadGameAsImage(game, e)}
                  disabled={downloadingId === game.id || !game.code}
                >
                  {downloadingId === game.id ? (
                    <Loader2 className="animate-spin mr-1" size={14} />
                  ) : (
                    <Download size={14} className="mr-1" />
                  )}
                  PNG
                </Button>
              </div>
            </div>)}
        </div> : <p className="text-center text-gray-500 py-8">
          No games have been created yet. Be the first to create one!
        </p>}
    </div>;
}
