
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, MessageSquare, X, History, RotateCcw, Download, FileText } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { GameChat } from "@/components/GameChat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import JSZip from 'jszip';
import html2pdf from 'html2pdf.js';

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

const Play = () => {
  const { id } = useParams();
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "PageUp", "PageDown", "Home", "End"].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const { data, error } = await supabase.from('games').select(`
            id,
            current_version,
            game_versions (
              id,
              version_number,
              code,
              instructions,
              created_at
            )
          `).eq('id', id).single();
        if (error) throw error;
        if (!data) throw new Error("Game not found");
        const sortedVersions = data.game_versions.sort((a, b) => b.version_number - a.version_number);
        setGameVersions(sortedVersions);
        const currentVersion = sortedVersions.find(v => v.version_number === data.current_version);
        if (currentVersion) {
          setSelectedVersion(currentVersion.id);
        }
      } catch (error) {
        toast({
          title: "Error loading game",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
  }, [id, toast]);

  useEffect(() => {
    if (!loading && iframeRef.current) {
      iframeRef.current.focus();
    }
  }, [loading]);

  const handleGameUpdate = async (newCode: string, newInstructions: string) => {
    try {
      // Create a new version with incremented version number
      const newVersionNumber = gameVersions.length > 0 ? gameVersions[0].version_number + 1 : 1;
      
      // Insert the new version into database
      const { data: versionData, error: versionError } = await supabase
        .from('game_versions')
        .insert({
          game_id: id,
          version_number: newVersionNumber,
          code: newCode,
          instructions: newInstructions
        })
        .select()
        .single();
        
      if (versionError) throw versionError;
      if (!versionData) throw new Error("Failed to save new version");
      
      // Update the game's current version
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          current_version: newVersionNumber,
          code: newCode,
          instructions: newInstructions
        })
        .eq('id', id);
        
      if (gameError) throw gameError;
      
      // Add the new version to state and select it
      const newVersion: GameVersion = {
        id: versionData.id,
        version_number: versionData.version_number,
        code: versionData.code,
        instructions: versionData.instructions,
        created_at: versionData.created_at
      };
      
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      
      toast({
        title: "Game updated successfully",
        description: `Version ${newVersionNumber} has been created and set as current.`
      });
      
    } catch (error) {
      console.error("Error saving new version:", error);
      toast({
        title: "Error saving version",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersion(versionId);
  };

  const handleRevertToVersion = async (version: GameVersion) => {
    try {
      const newVersion: GameVersion = {
        id: crypto.randomUUID(),
        version_number: gameVersions[0].version_number + 1,
        code: version.code,
        instructions: version.instructions,
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('game_versions').insert({
        id: newVersion.id,
        game_id: id,
        version_number: newVersion.version_number,
        code: newVersion.code,
        instructions: newVersion.instructions
      });
      if (error) throw error;
      
      // Update the game's current version
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          current_version: newVersion.version_number,
          code: newVersion.code,
          instructions: newVersion.instructions
        })
        .eq('id', id);
        
      if (gameError) throw gameError;
      
      setGameVersions(prev => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      toast({
        title: "Version reverted",
        description: `Created new version ${newVersion.version_number} based on version ${version.version_number}`
      });
    } catch (error) {
      toast({
        title: "Error reverting version",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied to clipboard",
      description: "The code has been copied to your clipboard",
    });
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

  const handleDownloadPDF = async () => {
    if (!currentVersion || !iframeRef.current) return;
    
    try {
      const iframe = iframeRef.current;
      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (!iframeDocument) {
        throw new Error("Cannot access iframe content");
      }

      const content = iframeDocument.documentElement.cloneNode(true) as HTMLElement;
      
      const opt = {
        margin: 0,
        filename: `version-${currentVersion.version_number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: true,
          allowTaint: true,
          foreignObjectRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        }
      };

      // Create a temporary container and apply the iframe's content
      const container = document.createElement('div');
      
      // Copy styles from iframe
      const styles = Array.from(iframeDocument.getElementsByTagName('style'));
      styles.forEach(style => {
        container.appendChild(style.cloneNode(true));
      });
      
      // Copy body content
      const bodyContent = iframeDocument.body.cloneNode(true);
      container.appendChild(bodyContent);
      
      // Add container to document temporarily
      document.body.appendChild(container);
      
      try {
        await html2pdf()
          .set(opt)
          .from(container)
          .save();
          
        toast({
          title: "PDF downloaded",
          description: "The content has been downloaded as a PDF file.",
        });
      } finally {
        // Always clean up the temporary container
        document.body.removeChild(container);
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Download failed",
        description: "There was an error downloading the PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>;
  }

  const currentVersion = gameVersions.find(v => v.id === selectedVersion);
  const selectedVersionNumber = currentVersion?.version_number;
  const isLatestVersion = selectedVersionNumber === gameVersions[0]?.version_number;

  return (
    <div className="min-h-screen flex bg-[#F5F5F5]">
      {showChat && (
        <div className="w-[400px] h-screen flex flex-col bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Modify Content</h2>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>
          </div>
          <div className="flex-1">
            <GameChat gameId={id!} onGameUpdate={handleGameUpdate} />
          </div>
        </div>
      )}

      <div className="flex-1 p-4 md:p-8 flex flex-col">
        <div className="max-w-[1200px] mx-auto w-full space-y-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft size={18} />
              <span className="text-sm">Back to Generator</span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {!isLatestVersion && currentVersion && (
                  <button 
                    onClick={() => handleRevertToVersion(currentVersion)} 
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <RotateCcw size={16} />
                    <span>Revert to this version</span>
                  </button>
                )}
                <History size={18} className="text-gray-500" />
                <Select value={selectedVersion} onValueChange={handleVersionChange}>
                  <SelectTrigger className="w-[180px] bg-white border-gray-200">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameVersions.map(version => (
                      <SelectItem key={version.id} value={version.id} className="flex items-center justify-between">
                        <span>Version {version.version_number}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleDownload}
                >
                  <Download size={16} />
                  Download Files
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleDownloadPDF}
                >
                  <FileText size={16} />
                  Download PDF
                </Button>
                {!showChat && (
                  <button 
                    onClick={() => setShowChat(true)} 
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  >
                    <MessageSquare size={18} />
                    <span>Show Chat</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {currentVersion && (
            <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-4 md:p-6 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-zinc-900 p-0.5 rounded-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                      !showCode 
                        ? 'bg-white text-black' 
                        : 'text-white hover:bg-white/20'
                    }`}
                    onClick={() => setShowCode(false)}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                      showCode 
                        ? 'bg-white text-black' 
                        : 'text-white hover:bg-white/20'
                    }`}
                    onClick={() => setShowCode(true)}
                  >
                    Code
                  </Button>
                </div>
              </div>

              <div className="flex-1 bg-white rounded-lg overflow-hidden">
                {!showCode ? (
                  <div 
                    className="h-full relative"
                    onClick={() => iframeRef.current?.focus()}
                  >
                    <iframe
                      ref={iframeRef}
                      srcDoc={currentVersion.code}
                      className="absolute inset-0 w-full h-full border border-gray-100"
                      sandbox="allow-scripts"
                      title="Generated Content"
                      tabIndex={0}
                    />
                  </div>
                ) : (
                  <div className="h-full relative">
                    <div className="absolute inset-0 overflow-auto">
                      <pre className="p-4 bg-gray-50 rounded-lg h-full">
                        <code className="text-sm whitespace-pre-wrap break-words">{currentVersion.code}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {currentVersion.instructions && (
                <div className="bg-gray-50/80 backdrop-blur-sm p-4 rounded-lg border border-gray-100 mt-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-2">Details</h2>
                  <div className="prose prose-sm max-w-none text-gray-600">
                    <ReactMarkdown>{currentVersion.instructions}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Play;
