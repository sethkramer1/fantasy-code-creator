
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import JSZip from 'jszip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

interface GameActionsProps {
  currentVersion: GameVersion | undefined;
  showGenerating: boolean;
  isLatestVersion: boolean;
  onRevertToVersion: (version: GameVersion) => Promise<void>;
}

export function GameActions({ 
  currentVersion, 
  showGenerating, 
  isLatestVersion,
  onRevertToVersion 
}: GameActionsProps) {
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!currentVersion) return;
    
    try {
      const zip = new JSZip();

      const parser = new DOMParser();
      const doc = parser.parseFromString(currentVersion.code, 'text/html');
      
      const styles = Array.from(doc.getElementsByTagName('style')).map(style => style.textContent).join('\n');
      if (styles) {
        zip.file('styles.css', styles);
        doc.querySelectorAll('style').forEach(style => style.remove());
      }

      const scripts = Array.from(doc.getElementsByTagName('script')).map(script => script.textContent).join('\n');
      if (scripts) {
        zip.file('script.js', scripts);
        doc.querySelectorAll('script').forEach(script => script.remove());
      }

      if (styles) {
        const linkTag = doc.createElement('link');
        linkTag.rel = 'stylesheet';
        linkTag.href = './styles.css';
        doc.head.appendChild(linkTag);
      }
      
      if (scripts) {
        const scriptTag = doc.createElement('script');
        scriptTag.src = './script.js';
        doc.body.appendChild(scriptTag);
      }

      zip.file('index.html', doc.documentElement.outerHTML);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `version-${currentVersion.version_number}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Files downloaded",
        description: "The HTML, CSS, and JS files have been downloaded as a ZIP file.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "There was an error downloading the files. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (showGenerating || !currentVersion) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-sm"
        onClick={handleDownload}
      >
        <Download size={14} />
        Zip
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1 text-sm bg-green-500 hover:bg-green-600"
          >
            <Upload size={14} />
            Deploy
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deploy your game</DialogTitle>
            <DialogDescription>
              Deploy your game to the web in just a few simple steps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="font-medium text-sm">1. Download your game files</h3>
              <p className="text-sm text-muted-foreground">
                First, download your game as a zip file.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1"
                onClick={handleDownload}
              >
                <Download size={14} />
                Download Zip
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm">2. Go to Netlify Drop</h3>
              <p className="text-sm text-muted-foreground">
                Visit <a href="https://netlify.com/drop" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">netlify.com/drop</a> in your browser.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm">3. Drop your zip file</h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop the downloaded zip file onto the Netlify Drop area. Netlify will automatically deploy your game and provide you with a unique URL.
              </p>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <DialogDescription className="text-xs text-muted-foreground pt-2">
              No account required. Completely free.
            </DialogDescription>
            <Button variant="default" size="sm">
              <a href="https://netlify.com/drop" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                Open Netlify Drop
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

