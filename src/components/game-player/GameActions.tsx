import { Download, Upload, GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import JSZip from 'jszip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";

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
  onExport?: () => void;
  onDownload?: () => void;
  onFork?: () => void;
  onShare?: () => void;
  showCodeEditor?: boolean;
  onShowCodeEditorChange?: (show: boolean) => void;
  gameUserId?: string | null;
  isForkingInProgress?: boolean;
}

export function GameActions({
  currentVersion,
  showGenerating,
  isLatestVersion,
  onRevertToVersion,
  onExport,
  onDownload,
  onFork,
  onShare,
  showCodeEditor,
  onShowCodeEditorChange,
  gameUserId,
  isForkingInProgress = false
}: GameActionsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Check if current user is the owner of the game
  const isOwner = user?.id && gameUserId === user?.id;
  
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
      const content = await zip.generateAsync({
        type: 'blob'
      });
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
        description: "The HTML, CSS, and JS files have been downloaded as a ZIP file."
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
  
  return <div className="flex items-center gap-2">
      {onFork && user && (
        <Button 
          variant="secondary" 
          size="sm" 
          className="h-8 gap-1 text-sm bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300" 
          onClick={onFork}
          disabled={isForkingInProgress}
        >
          {isForkingInProgress ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-blue-700 border-t-transparent rounded-full mr-1"></span>
              Forking...
            </>
          ) : (
            <>
              <GitFork size={14} />
              Fork
            </>
          )}
        </Button>
      )}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="default" size="sm" className="h-8 gap-1 text-sm bg-green-500 hover:bg-green-600">
            <Upload size={14} />
            Deploy
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deploy to the web for free</DialogTitle>
            <DialogDescription>Deploy your to the web in just a few simple steps.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="font-medium text-sm">1. Download your files</h3>
              <p className="text-sm text-muted-foreground">First, download as a zip file.</p>
              <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={onDownload || handleDownload}>
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
              <h3 className="font-medium text-sm">3. Unzip your file and drop the folder in</h3>
              <p className="text-sm text-muted-foreground">Drag and drop the downloaded folder onto the Netlify Drop area. Netlify will automatically deploy and provide you with a unique URL.</p>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <DialogDescription className="text-xs text-muted-foreground pt-2">
          </DialogDescription>
            <Button variant="default" size="sm">
              <a href="https://netlify.com/drop" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                Open Netlify Drop
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}
