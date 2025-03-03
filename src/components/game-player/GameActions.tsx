
import { useState, useEffect } from "react";
import { Download, Globe, Loader2 } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [netlifyCalling, setNetlifyCalling] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  const checkNetlifyAuth = async () => {
    if (!gameId) return;
    
    setIsCheckingAuth(true);
    try {
      console.log("Checking Netlify auth for game:", gameId);
      const { data, error } = await supabase.functions.invoke('netlify-integration', {
        body: { path: 'check-token', gameId }
      });
      
      if (error) {
        console.error("Netlify auth check error:", error);
        throw error;
      }

      console.log("Netlify auth check result:", data);
      setIsAuthorized(data?.authorized || false);
    } catch (error) {
      console.error("Error checking Netlify auth:", error);
      // Don't show toast for failed check as it's not user-initiated
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleNetlifyAuth = async () => {
    try {
      setNetlifyCalling(true);
      console.log("Starting Netlify OAuth flow for game:", gameId);
      
      const { data, error } = await supabase.functions.invoke('netlify-integration', {
        body: { path: 'start-oauth', gameId }
      });
      
      if (error) {
        console.error("Netlify auth start error:", error);
        throw error;
      }
      
      console.log("Netlify auth start response:", data);
      
      // Store the game ID for the callback to retrieve
      localStorage.setItem('netlify_deploy_game_id', gameId);
      
      if (data?.authUrl) {
        // Use window.location.href for actual navigation to Netlify OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authentication URL received from server");
      }
    } catch (error) {
      console.error("Error starting Netlify auth:", error);
      toast({
        title: "Authentication Failed",
        description: "Could not connect to Netlify. Please try again.",
        variant: "destructive"
      });
      setNetlifyCalling(false);
    }
  };

  const validateSiteName = (name: string): boolean => {
    // Netlify site names can only contain letters, numbers, and hyphens
    const validNameRegex = /^[a-z0-9\-]+$/;
    return validNameRegex.test(name);
  };

  const deployToNetlify = async () => {
    if (!siteName.trim() || !gameId || !currentVersion) return;
    
    // Validate site name
    if (!validateSiteName(siteName)) {
      setDeployError("Site name can only contain lowercase letters, numbers, and hyphens");
      return;
    }
    
    setDeploying(true);
    setDeployError(null);
    
    try {
      console.log("Deploying to Netlify with site name:", siteName);
      
      const { data, error } = await supabase.functions.invoke('netlify-integration', {
        body: { 
          path: 'deploy', 
          gameId, 
          siteName: siteName.trim(),
          code: currentVersion.code // Send the current version's code directly
        }
      });
      
      if (error) {
        console.error("Netlify deploy error:", error);
        setDeployError(error.message || "Deployment failed. Please try again.");
        throw error;
      }
      
      console.log("Netlify deploy response:", data);
      
      // Store the deployed URL for display
      if (data && data.site_url) {
        setDeployedUrl(data.site_url);
        toast({
          title: "Deployment Successful!",
          description: `Your site has been deployed to ${data.site_url}`,
        });
      } else {
        throw new Error("No site URL returned from deployment");
      }
    } catch (error) {
      console.error("Deployment error:", error);
      toast({
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "There was an error deploying to Netlify. Please try again.",
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
      
      // Extract styles
      const styles = Array.from(doc.getElementsByTagName('style')).map(style => style.textContent).join('\n');
      if (styles) {
        zip.file('styles.css', styles);
        doc.querySelectorAll('style').forEach(style => style.remove());
      }

      // Extract scripts
      const scripts = Array.from(doc.getElementsByTagName('script')).map(script => script.textContent).join('\n');
      if (scripts) {
        zip.file('script.js', scripts);
        doc.querySelectorAll('script').forEach(script => script.remove());
      }

      // Add link to CSS
      if (styles) {
        const linkTag = doc.createElement('link');
        linkTag.rel = 'stylesheet';
        linkTag.href = './styles.css';
        doc.head.appendChild(linkTag);
      }
      
      // Add script tag
      if (scripts) {
        const scriptTag = doc.createElement('script');
        scriptTag.src = './script.js';
        doc.body.appendChild(scriptTag);
      }

      // Add index.html
      zip.file('index.html', doc.documentElement.outerHTML);

      // Create readme with Netlify deploy button
      const readmeContent = `# Game Export

This is an exported game that can be deployed to various platforms.

## Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/netlify/netlify-templates/tree/main/vanilla-html)

After clicking the button:
1. Connect to GitHub (create an account if needed)
2. Choose a repository name
3. Click "Save & Deploy"
`;
      zip.file('README.md', readmeContent);

      // Create netlify.toml for proper deployment settings
      const netlifyConfig = `[build]
  publish = "./"
`;
      zip.file('netlify.toml', netlifyConfig);

      // Generate and download the zip
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
        description: "The game files have been downloaded as a ZIP file with Netlify deployment options.",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "There was an error downloading the files. Please try again.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (gameId) {
      checkNetlifyAuth();
    }
  }, [gameId]);

  // Reset deployment state when dialog closes
  useEffect(() => {
    if (!deployDialogOpen) {
      setDeployedUrl(null);
      setDeployError(null);
    }
  }, [deployDialogOpen]);

  if (showGenerating || !currentVersion) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-sm"
                onClick={handleDownload}
              >
                <Download size={14} />
                Download
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Download as HTML, CSS, and JS
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
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
                disabled={isCheckingAuth || netlifyCalling}
              >
                <Globe size={14} />
                {isAuthorized ? "Deploy to Netlify" : "Connect to Netlify"}
                {(isCheckingAuth || netlifyCalling) && (
                  <Loader2 className="ml-1 h-3 w-3 animate-spin" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isAuthorized 
                ? "Deploy your game to Netlify hosting" 
                : "Connect to Netlify to enable deployment"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Deploy to Netlify</DialogTitle>
            <DialogDescription>
              Enter a name for your Netlify site. It will be available at [name].netlify.app
            </DialogDescription>
          </DialogHeader>
          
          {!deployedUrl ? (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="site-name" className="text-right col-span-1">
                    Site Name
                  </Label>
                  <Input
                    id="site-name"
                    placeholder="my-awesome-game"
                    className="col-span-3"
                    value={siteName}
                    onChange={(e) => {
                      setSiteName(e.target.value.toLowerCase());
                      setDeployError(null);
                    }}
                  />
                </div>
                
                {deployError && (
                  <div className="text-red-500 text-sm mt-1 col-span-4">
                    {deployError}
                  </div>
                )}
                
                <div className="col-span-4 text-xs text-gray-500">
                  <p>Site name can only contain lowercase letters, numbers, and hyphens.</p>
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
                  {deploying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deploying...
                    </>
                  ) : "Deploy"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-6">
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
                <p className="font-medium text-green-800 mb-2">🎉 Deployment Successful!</p>
                <p className="text-sm text-green-700 mb-4">Your site is live at:</p>
                <a
                  href={deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:text-blue-800 underline block mb-4 break-all"
                >
                  {deployedUrl}
                </a>
                <Button 
                  onClick={() => setDeployDialogOpen(false)}
                  className="mt-2"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
