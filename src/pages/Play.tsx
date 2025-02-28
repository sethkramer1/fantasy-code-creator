
import { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, History, RotateCcw, Download } from "lucide-react";
import { GameChat } from "@/components/GameChat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
import { useGameGeneration } from "@/hooks/useGameGeneration";
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
  const [searchParams] = useSearchParams();
  const isGenerating = searchParams.get('generating') === 'true';
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [showGenerating, setShowGenerating] = useState(isGenerating);
  const [pollingStatus, setPollingStatus] = useState(isGenerating);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "> Starting generation process...", 
    "> Creating your design based on your prompt..."
  ]);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [streamConnected, setStreamConnected] = useState(false);
  const streamConnectionAttemptedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Connect to the generation stream if we're in generation mode
  useEffect(() => {
    if (isGenerating && id && !streamConnected && !streamConnectionAttemptedRef.current) {
      streamConnectionAttemptedRef.current = true;
      
      // Start a timer to show thinking time
      timerRef.current = setInterval(() => {
        setThinkingSeconds(prev => prev + 1);
      }, 1000);
      
      // Setup an EventSource connection to watch generation progress
      const connectToStream = async () => {
        try {
          // Subscribe to game_versions updates to catch when a real version is created
          const gameVersionSub = supabase
            .channel('game-version-updates')
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'game_versions',
              filter: `game_id=eq.${id}`,
            }, (payload) => {
              console.log('New game version created:', payload);
              if (payload.new && payload.new.code !== "Generating...") {
                // Once we have real content, refresh and show it
                setPollingStatus(false);
                setShowGenerating(false);
                navigate(`/play/${id}`, { replace: true });
                fetchGame();
                
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                }
                
                toast({
                  title: "Generation complete",
                  description: "Your content has been generated successfully."
                });
              }
            })
            .subscribe();
            
          // Also setup direct polling to check the status
          const pollingInterval = setInterval(async () => {
            try {
              const { data, error } = await supabase
                .from('games')
                .select('code')
                .eq('id', id)
                .single();
                
              console.log('Polling game status:', data);
              
              if (error) {
                console.error('Error polling game status:', error);
                return;
              }
              
              if (data && data.code !== "Generating...") {
                setPollingStatus(false);
                setShowGenerating(false);
                clearInterval(pollingInterval);
                navigate(`/play/${id}`, { replace: true });
                fetchGame();
                
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                }
                
                toast({
                  title: "Generation complete",
                  description: "Your content has been generated successfully."
                });
              }
            } catch (err) {
              console.error('Error in polling interval:', err);
            }
          }, 5000);
          
          // Connect to the Supabase Edge Function to get real-time generation updates
          // This uses a custom endpoint that streams the generation progress
          const response = await fetch(
            `https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/stream-generation?gameId=${id}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`,
              },
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error connecting to stream:', errorText);
            setTerminalOutput(prev => [...prev, `> Error connecting to generation stream: ${response.status}`]);
            setTerminalOutput(prev => [...prev, `> Fallback to polling for updates...`]);
            return;
          }
          
          setStreamConnected(true);
          console.log('Connected to generation stream');
          setTerminalOutput(prev => [...prev, `> Connected to generation stream...`]);
          
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No reader available from stream');
          }
          
          // Process the stream data
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            buffer += chunk;
            
            // Process complete lines from the buffer
            let lineEnd;
            while ((lineEnd = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, lineEnd).trim();
              buffer = buffer.slice(lineEnd + 1);
              
              if (!line) continue;
              
              // Check if it's server-sent event data
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(5));
                  
                  if (data.type === 'thinking') {
                    setTerminalOutput(prev => [...prev, `> Thinking: ${data.thinking || 'processing...'}`]);
                  } else if (data.type === 'content' || data.type === 'text') {
                    setTerminalOutput(prev => [...prev, `> ${data.content || data.text || 'generating content...'}`]);
                  } else if (data.type === 'error') {
                    setTerminalOutput(prev => [...prev, `> Error: ${data.error || 'Unknown error'}`]);
                  } else if (data.type) {
                    // For any other event types
                    setTerminalOutput(prev => [...prev, `> ${data.type}: ${JSON.stringify(data).slice(0, 100)}`]);
                  }
                } catch (e) {
                  console.error('Error parsing stream data:', e);
                  // Just add the raw line if we can't parse it as JSON
                  if (line.length > 6) {
                    setTerminalOutput(prev => [...prev, `> ${line.slice(5)}`]);
                  }
                }
              } else {
                // If it's not JSON data, just display the line
                setTerminalOutput(prev => [...prev, `> ${line}`]);
              }
            }
          }
          
          console.log('Stream completed');
          setTerminalOutput(prev => [...prev, '> Stream completed. Waiting for final content...']);
          
          // Clean up
          return () => {
            gameVersionSub.unsubscribe();
            clearInterval(pollingInterval);
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
          };
          
        } catch (error) {
          console.error('Error connecting to generation stream:', error);
          setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : 'Unknown error connecting to stream'}`]);
          setTerminalOutput(prev => [...prev, '> Falling back to polling for updates...']);
          
          // Even if streaming fails, we still poll for completion
          return () => {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
          };
        }
      };
      
      connectToStream();
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [id, isGenerating, streamConnected, navigate, toast]);
  
  // Create a fallback messages system for when we don't have a stream
  useEffect(() => {
    if (showGenerating && pollingStatus && !streamConnected && thinkingSeconds > 0) {
      // Add descriptive fallback messages over time
      if (thinkingSeconds === 10) {
        setTerminalOutput(prev => [...prev, "> Analyzing your requirements..."]);
      } else if (thinkingSeconds === 20) {
        setTerminalOutput(prev => [...prev, "> Creating the structure..."]);
      } else if (thinkingSeconds === 30) {
        setTerminalOutput(prev => [...prev, "> Adding styling and functionality..."]);
      } else if (thinkingSeconds % 20 === 0 && thinkingSeconds > 0) {
        setTerminalOutput(prev => [...prev, "> Still working, this might take a minute..."]);
      }
    }
  }, [showGenerating, pollingStatus, streamConnected, thinkingSeconds]);

  // Prevent keyboard events from being captured by the iframe
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
      
      // Sort versions by version_number in descending order (latest first)
      const sortedVersions = data.game_versions.sort((a, b) => b.version_number - a.version_number);
      setGameVersions(sortedVersions);
      
      // Always select the latest version (first in the sorted array)
      if (sortedVersions.length > 0) {
        setSelectedVersion(sortedVersions[0].id);
        console.log("Selected latest version:", sortedVersions[0].version_number);
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

  useEffect(() => {
    fetchGame();
  }, [id, toast]);

  // Helper function to inject scripts and fix common iframe issues
  const prepareIframeContent = (html: string) => {
    // Helper script to ensure tabs and anchor links work correctly
    const helperScript = `
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          console.log('DOM fully loaded, setting up UI enhancements');
          
          document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
              e.preventDefault();
              const targetId = this.getAttribute('href').substring(1);
              const targetElement = document.getElementById(targetId);
              
              if (targetElement) {
                targetElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                });
              }
            });
          });
          
          const setupDataTabs = function() {
            const tabs = document.querySelectorAll('[data-tab]');
            if (tabs.length > 0) {
              console.log('Found data-tab tabs:', tabs.length);
              tabs.forEach(tab => {
                tab.addEventListener('click', function() {
                  const target = this.getAttribute('data-tab');
                  
                  document.querySelectorAll('[data-tab-content]').forEach(content => {
                    content.style.display = 'none';
                  });
                  
                  if (target) {
                    const targetContent = document.querySelector('[data-tab-content="' + target + '"]');
                    if (targetContent) {
                      targetContent.style.display = 'block';
                    }
                  }
                  
                  tabs.forEach(t => t.classList.remove('active'));
                  this.classList.add('active');
                });
              });
              
              if (!document.querySelector('[data-tab].active')) {
                const firstTab = document.querySelector('[data-tab]');
                if (firstTab) {
                  firstTab.click();
                }
              }
            }
          };
          
          const setupAriaTabs = function() {
            const tabButtons = document.querySelectorAll('[role="tab"]');
            if (tabButtons.length > 0) {
              console.log('Found ARIA tabs:', tabButtons.length);
              tabButtons.forEach(button => {
                button.addEventListener('click', function() {
                  const controls = this.getAttribute('aria-controls');
                  const tablist = this.closest('[role="tablist"]');
                  
                  if (tablist) {
                    tablist.querySelectorAll('[role="tab"]').forEach(tab => {
                      tab.setAttribute('aria-selected', 'false');
                      tab.classList.remove('active');
                    });
                    
                    this.setAttribute('aria-selected', 'true');
                    this.classList.add('active');
                    
                    document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
                      panel.setAttribute('hidden', '');
                      panel.style.display = 'none';
                    });
                    
                    if (controls) {
                      const panel = document.getElementById(controls);
                      if (panel) {
                        panel.removeAttribute('hidden');
                        panel.style.display = 'block';
                      }
                    }
                  }
                });
              });
              
              const tablist = document.querySelector('[role="tablist"]');
              if (tablist && !tablist.querySelector('[aria-selected="true"]')) {
                const firstTab = tablist.querySelector('[role="tab"]');
                if (firstTab) {
                  firstTab.click();
                }
              }
            }
          };
          
          const setupClassTabs = function() {
            const tabButtons = document.querySelectorAll('.tabs .tab, .tab-list .tab, .tabs-nav .tab-link');
            if (tabButtons.length > 0) {
              console.log('Found class-based tabs:', tabButtons.length);
              tabButtons.forEach(button => {
                button.addEventListener('click', function(e) {
                  e.preventDefault();
                  
                  let target = this.getAttribute('href');
                  if (!target || !target.startsWith('#')) {
                    target = this.dataset.target || this.dataset.href;
                  } else {
                    target = target.substring(1);
                  }
                  
                  const tabContainer = this.closest('.tabs, .tab-container, .tabs-wrapper');
                  
                  if (tabContainer) {
                    tabContainer.querySelectorAll('.tab, .tab-link').forEach(tab => {
                      tab.classList.remove('active');
                    });
                    
                    this.classList.add('active');
                    
                    tabContainer.querySelectorAll('.tab-content, .tab-pane, .tabs-content > div').forEach(panel => {
                      panel.style.display = 'none';
                      panel.classList.remove('active');
                    });
                    
                    if (target) {
                      const panel = document.getElementById(target) || 
                                    tabContainer.querySelector('[data-tab="' + target + '"]') ||
                                    tabContainer.querySelector('.' + target);
                      
                      if (panel) {
                        panel.style.display = 'block';
                        panel.classList.add('active');
                      }
                    }
                  }
                });
              });
              
              const tabContainer = document.querySelector('.tabs, .tab-container, .tabs-wrapper');
              if (tabContainer && !tabContainer.querySelector('.tab.active, .tab-link.active')) {
                const firstTab = tabContainer.querySelector('.tab, .tab-link');
                if (firstTab) {
                  firstTab.click();
                }
              }
            }
          };
          
          setupDataTabs();
          setupAriaTabs();
          setupClassTabs();
          
          setTimeout(() => {
            document.querySelectorAll('.tabs .active, [role="tab"][aria-selected="true"], [data-tab].active')
              .forEach(activeTab => {
                console.log('Triggering click on already active tab to ensure content is visible');
                activeTab.click();
              });
            
            window.dispatchEvent(new Event('resize'));
          }, 300);
        });

        window.addEventListener('load', function() {
          console.log('Window loaded, re-running tab initialization');
          window.dispatchEvent(new Event('resize'));
        });
      </script>
    `;

    // Check if the document has a <head> tag
    if (html.includes('<head>')) {
      return html.replace('<head>', '<head>' + helperScript);
    } else if (html.includes('<html')) {
      // If it has <html> but no <head>, insert head after html opening tag
      return html.replace(/<html[^>]*>/, '$&<head>' + helperScript + '</head>');
    } else {
      // If neither, just prepend the script
      return helperScript + html;
    }
  };

  useEffect(() => {
    if (!loading && iframeRef.current) {
      iframeRef.current.focus();
      
      // Set up message event listener for communication with iframe
      const handleIframeMessage = (event: MessageEvent) => {
        if (event.source === iframeRef.current?.contentWindow) {
          console.log('Message from iframe:', event.data);
        }
      };
      
      window.addEventListener('message', handleIframeMessage);
      return () => {
        window.removeEventListener('message', handleIframeMessage);
      };
    }
  }, [loading, selectedVersion]);

  const handleGameUpdate = async (newCode: string, newInstructions: string) => {
    try {
      // Show generation UI
      setShowGenerating(true);
      
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
      setShowGenerating(false);
      
      toast({
        title: "Code updated successfully",
        description: `Version ${newVersionNumber} has been created and set as current.`
      });
      
    } catch (error) {
      console.error("Error saving new version:", error);
      setShowGenerating(false);
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
    const currentVersion = gameVersions.find(v => v.id === selectedVersion);
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

  if (loading && !showGenerating) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>;
  }

  // Compute currentVersion and isLatestVersion here to make them available throughout the component
  const currentVersion = gameVersions.find(v => v.id === selectedVersion);
  const isLatestVersion = currentVersion?.version_number === gameVersions[0]?.version_number;

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F5]">
      {/* Navbar */}
      <div className="w-full h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-10 shadow-sm flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {!showGenerating && !isLatestVersion && currentVersion && (
              <button 
                onClick={() => handleRevertToVersion(currentVersion)} 
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <RotateCcw size={16} />
                <span>Revert to this version</span>
              </button>
            )}
            {!showGenerating && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-sm"
                onClick={handleDownload}
                disabled={!currentVersion}
              >
                <Download size={14} />
                Download
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[400px] flex flex-col bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center">
              <h2 className="text-lg font-medium text-gray-900">Modify Content</h2>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <GameChat gameId={id!} onGameUpdate={handleGameUpdate} />
          </div>
        </div>

        <div className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden">
          <div className="max-w-[1200px] mx-auto w-full flex-1 flex flex-col">
            <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                  {!showGenerating && (
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
                  )}
                </div>
                
                {!showGenerating && gameVersions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-gray-500" />
                    <Select value={selectedVersion} onValueChange={handleVersionChange}>
                      <SelectTrigger className="w-[140px] h-8 bg-white border-gray-200 text-sm">
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
                )}
              </div>

              <div className="flex-1 bg-white rounded-lg overflow-hidden">
                {/* Show generation terminal when generating */}
                {showGenerating ? (
                  <GenerationTerminal
                    output={terminalOutput}
                    thinkingTime={thinkingSeconds}
                    loading={pollingStatus}
                    asModal={false}
                  />
                ) : !showCode ? (
                  <div 
                    className="h-full relative"
                    onClick={() => iframeRef.current?.focus()}
                  >
                    <iframe
                      ref={iframeRef}
                      srcDoc={currentVersion ? prepareIframeContent(currentVersion.code) : ""}
                      className="absolute inset-0 w-full h-full border border-gray-100"
                      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                      title="Generated Content"
                      tabIndex={0}
                    />
                  </div>
                ) : (
                  <div className="h-full relative">
                    <div className="absolute inset-0 overflow-auto">
                      <pre className="p-4 bg-gray-50 rounded-lg h-full">
                        <code className="text-sm whitespace-pre-wrap break-words">{currentVersion?.code}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;
