import { Download, Upload, GitFork, ExternalLink, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import JSZip from 'jszip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string | null>(null);
  
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
  
  const handleDeploy = async () => {
    if (!currentVersion || !user) return;
    
    try {
      setIsDeploying(true);
      setDeploymentError(null);
      
      // Call the Netlify deployment function
      const { data, error } = await supabase.functions.invoke('deploy-to-netlify', {
        body: {
          gameId: currentVersion.id.split('-')[0], // Assuming the game ID is the first part of the version ID
          versionId: currentVersion.id,
          siteTitle: `fantasy-code-v${currentVersion.version_number}`,
          siteId: siteId, // Pass the site ID if we have one (for redeployment)
          siteName: siteName // Pass the site name if we have one (for redeployment)
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setDeploymentUrl(data.deployment.siteUrl);
      setSiteId(data.deployment.siteId);
      setSiteName(data.deployment.siteName);
      toast({
        title: "Deployment successful!",
        description: "Your project has been deployed to Netlify.",
        variant: "default"
      });
    } catch (error) {
      console.error('Deployment error:', error);
      setDeploymentError(error.message || 'Failed to deploy to Netlify');
      toast({
        title: "Deployment failed",
        description: error.message || "There was an error deploying to Netlify. Please try the manual method.",
        variant: "destructive"
      });
    } finally {
      setIsDeploying(false);
    }
  };
  
  if (showGenerating || !currentVersion) {
    return null;
  }
  
  return <div className="flex items-center gap-2">
      {/* Deploy button - only shown to owner */}
      {isOwner && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" className="h-8 gap-1 text-sm bg-green-500 hover:bg-green-600">
              <Upload size={14} />
              Deploy
            </Button>
          </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deploy to the web</DialogTitle>
            <DialogDescription>
              {deploymentUrl 
                ? "Your project has been deployed successfully!" 
                : "Deploy your project to the web with one click or manually."}
            </DialogDescription>
          </DialogHeader>
          
          {deploymentUrl ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-green-600">
                <Check size={20} />
                <span className="font-medium">Deployment successful!</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-md border flex items-center justify-between">
                <span className="text-sm font-medium truncate">{deploymentUrl}</span>
                <a href={deploymentUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ExternalLink size={14} />
                  </Button>
                </a>
              </div>
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1 w-full" 
                  onClick={() => {
                    // Keep the site ID and name when redeploying
                    // Only reset the deployment URL to show loading state
                    setDeploymentUrl(null);
                    handleDeploy();
                  }}
                  disabled={isDeploying}
                >
                  {isDeploying ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-1"></span>
                      Redeploying...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Redeploy
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {deploymentError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-md border border-red-200 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Deployment failed</p>
                    <p className="text-sm">{deploymentError}</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Option 1: One-click deploy (Recommended)</h3>
                <p className="text-sm text-muted-foreground">
                  Deploy directly to Netlify with one click. This will create a new site on Netlify.
                </p>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="mt-2 gap-1 bg-[#00AD9F] hover:bg-[#00968A]" 
                  onClick={handleDeploy}
                  disabled={isDeploying}
                >
                  {isDeploying ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-1"></span>
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Deploy to Netlify
                    </>
                  )}
                </Button>
              </div>
              
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Option 2: Manual deploy</h3>
                <p className="text-sm text-muted-foreground">
                  If you prefer to deploy manually, follow these steps:
                </p>
                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <p className="text-sm flex items-center gap-1">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">1</span>
                      Download your files
                    </p>
                    {isOwner && (
                      <Button variant="outline" size="sm" className="ml-6 gap-1" onClick={onDownload || handleDownload}>
                        <Download size={14} />
                        Download Zip
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm flex items-center gap-1">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">2</span>
                      Go to <a href="https://netlify.com/drop" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">netlify.com/drop</a>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm flex items-center gap-1">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">3</span>
                      Drag and drop the unzipped folder
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-between sm:justify-between">
            {deploymentUrl ? (
              <Button variant="default" size="sm" className="gap-1">
                <a href={deploymentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  <ExternalLink size={14} />
                  Visit Site
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm">
                <a href="https://netlify.com/drop" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  Open Netlify Drop
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>;
}
