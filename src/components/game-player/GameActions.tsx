
import { useState, useEffect } from "react";
import { Download, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import JSZip from 'jszip';
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  gameId: string;
}

export function GameActions({ 
  currentVersion, 
  showGenerating, 
  isLatestVersion,
  onRevertToVersion,
  gameId
}: GameActionsProps) {
  const { toast } = useToast();
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  // Check Netlify authorization status
  const checkNetlifyAuth = async () => {
    if (!gameId) return;
    
    setIsCheckingAuth(true);
    try {
      const { data, error } = await supabase.functions.invoke('netlify-integration', {
        body: { path: 'check-token', gameId }
      });
      
      if (error) throw error;
      setIsAuthorized(data?.authorized || false);
    } catch (error) {
      console.error("Error checking Netlify auth:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Start Netlify OAuth flow
  const handleNetlifyAuth = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('netlify-integration', {
        body: { path: 'start-oauth', gameId }
      });
      
      if (error) {
        throw error;
      }
      
      // Store game ID in localStorage to retrieve after redirect
      localStorage.setItem('netlify_deploy_game_id', gameId);
      
      // Redirect to Netlify auth
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("No auth URL received");
      }
    } catch (error) {
      console.error("Error starting Netlify auth:", error);
      toast({
        title: "Authentication Failed",
        description: "Could not connect to Netlify. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Deploy to Netlify
  const deployToNetlify = async () => {
    if (!siteName.trim() || !gameId) return;
    
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke('netlify-integration', {
        body: { path: 'deploy', gameId, siteName: siteName.trim() }
      });
      
      if (error) {
        throw error;
      }
      
      setDeployDialogOpen(false);
      
      toast({
        title: "Deployment Successful!",
        description: (
          <div>
            Your site has been deployed to{' '}
            <a 
              href={data.site_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              {data.site_url}
            </a>
          </div>
        )
      });
    } catch (error) {
      console.error("Deployment error:", error);
      toast({
        title: "Deployment Failed",
        description: "There was an error deploying to Netlify. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeploying(false);
    }
  };

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

  // Check auth status on component mount
  useEffect(() => {
    checkNetlifyAuth();
  }, [gameId]);

  if (showGenerating || !currentVersion) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-sm"
          onClick={handleDownload}
        >
          <Download size={14} />
          Download
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-sm"
          onClick={() => {
            if (isAuthorized) {
              setDeployDialogOpen(true);
            } else {
              handleNetlifyAuth();
            }
          }}
          disabled={isCheckingAuth}
        >
          <Globe size={14} />
          {isAuthorized ? "Deploy to Netlify" : "Connect to Netlify"}
        </Button>
      </div>
      
      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Deploy to Netlify</DialogTitle>
            <DialogDescription>
              Enter a name for your Netlify site. It will be available at [name].netlify.app
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="site-name" className="text-right col-span-1">
                Site Name
              </Label>
              <Input
                id="site-name"
                placeholder="my-awesome-site"
                className="col-span-3"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setDeployDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={deployToNetlify}
              disabled={!siteName.trim() || deploying}
            >
              {deploying ? "Deploying..." : "Deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
