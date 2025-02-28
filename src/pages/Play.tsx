import { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, History, RotateCcw, Download } from "lucide-react";
import { GameChat } from "@/components/GameChat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GenerationTerminal } from "@/components/game-creator/GenerationTerminal";
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
  const gameType = searchParams.get('type') || '';
  const encodedImageUrl = searchParams.get('imageUrl') || '';
  const imageUrl = encodedImageUrl ? decodeURIComponent(encodedImageUrl) : '';
  
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [showGenerating, setShowGenerating] = useState(isGenerating);
  const [generationInProgress, setGenerationInProgress] = useState(isGenerating);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "> Starting generation process...", 
    "> Creating your design based on your prompt..."
  ]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const thinkingTimerRef = useRef<NodeJS.Timeout>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const generationStartedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Start timer for thinking time
  useEffect(() => {
    if (generationInProgress) {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
      
      thinkingTimerRef.current = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    }
    
    return () => {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    };
  }, [generationInProgress]);

  // Start generation if we're in generating mode
  useEffect(() => {
    if (isGenerating && id && !generationStartedRef.current) {
      generationStartedRef.current = true;
      handleInitialGeneration();
    }
  }, [isGenerating, id]);

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

  const handleInitialGeneration = async () => {
    try {
      if (!id) return;
      
      // Get game details to get the prompt
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('prompt, type')
        .eq('id', id)
        .single();
        
      if (gameError) throw gameError;
      if (!gameData) throw new Error("Game not found");
      
      const prompt = gameData.prompt;
      const contentType = gameData.type || gameType;
      
      // Update terminal with prompt info
      setTerminalOutput(prev => [
        ...prev, 
        `> Generating content with prompt: "${prompt}"`,
        `> Content type: ${contentType}`
      ]);
      
      if (imageUrl) {
        setTerminalOutput(prev => [...prev, "> Including image with request"]);
      }
      
      // Call the generation API directly
      setTerminalOutput(prev => [...prev, "> Connecting to AI service..."]);
      
      const response = await fetch(
        'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo',
          },
          body: JSON.stringify({ 
            prompt: `Create a web design prototype with the following requirements. Include responsive design: ${prompt}`, 
            imageUrl: imageUrl || undefined
          }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorJson.error || errorJson.message || 'Unknown error'}`);
        } catch (e) {
          throw new Error(`HTTP error! status: ${response.status}, response: ${errorText.substring(0, 100)}...`);
        }
      }
      
      setTerminalOutput(prev => [...prev, `> Connected to generation service, receiving stream...`]);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      
      let gameContent = '';
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode the chunk and add it to our buffer
        const text = new TextDecoder().decode(value);
        buffer += text;
        
        // Process complete lines from the buffer
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(5));
            
            switch (data.type) {
              case 'message_start':
                setTerminalOutput(prev => [...prev, "> AI is analyzing your request..."]);
                break;
                
              case 'content_block_start':
                if (data.content_block?.type === 'thinking') {
                  setTerminalOutput(prev => [...prev, "\n> Thinking phase started..."]);
                }
                break;
                
              case 'content_block_delta':
                if (data.delta?.type === 'thinking_delta') {
                  const thinking = data.delta.thinking || '';
                  if (thinking && thinking.trim()) {
                    setTerminalOutput(prev => [...prev, `> ${thinking}`]);
                  }
                } else if (data.delta?.type === 'text_delta') {
                  const content = data.delta.text || '';
                  if (content) {
                    gameContent += content;
                    
                    // Display the content in smaller chunks for better visibility
                    if (content.includes('\n')) {
                      // If it contains newlines, split it and display each line
                      const contentLines = content.split('\n');
                      for (const contentLine of contentLines) {
                        if (contentLine.trim()) {
                          setTerminalOutput(prev => [...prev, `> ${contentLine}`]);
                        }
                      }
                    } else {
                      // Otherwise display the chunk directly
                      setTerminalOutput(prev => [...prev, `> ${content}`]);
                    }
                  }
                }
                break;
                
              case 'content_block_stop':
                if (data.content_block?.type === 'thinking') {
                  setTerminalOutput(prev => [...prev, "> Thinking phase completed"]);
                }
                break;
                
              case 'message_delta':
                if (data.delta?.stop_reason) {
                  setTerminalOutput(prev => [...prev, `> Generation ${data.delta.stop_reason}`]);
                }
                break;
                
              case 'message_stop':
                setTerminalOutput(prev => [...prev, "> Game generation completed!"]);
                break;
                
              case 'error':
                throw new Error(data.error?.message || 'Unknown error in stream');
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e);
            setTerminalOutput(prev => [...prev, `> Error: ${e instanceof Error ? e.message : 'Unknown error'}`]);
          }
        }
      }
      
      if (!gameContent) {
        throw new Error("No content received");
      }

      setTerminalOutput(prev => [...prev, "> Saving to database..."]);
      
      // For SVG content type, wrap the SVG in basic HTML if it's just raw SVG
      if (contentType === 'svg' && !gameContent.includes('<!DOCTYPE html>')) {
        gameContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    svg { max-width: 100%; max-height: 100vh; }
  </style>
</head>
<body>
  ${gameContent}
</body>
</html>`;
      }
      
      // Update the game with generated content
      const { error: updateGameError } = await supabase
        .from('games')
        .update({ 
          code: gameContent,
          instructions: "Content generated successfully"
        })
        .eq('id', id);
        
      if (updateGameError) throw updateGameError;
      
      // Update the game version with the generated content
      const { error: updateVersionError } = await supabase
        .from('game_versions')
        .update({
          code: gameContent,
          instructions: "Content generated successfully"
        })
        .eq('game_id', id)
        .eq('version_number', 1);
        
      if (updateVersionError) throw updateVersionError;
      
      // Add initial message to game_messages if it doesn't exist
      const { data: existingMessages } = await supabase
        .from('game_messages')
        .select('id')
        .eq('game_id', id)
        .limit(1);
        
      if (!existingMessages || existingMessages.length === 0) {
        const { error: messageError } = await supabase
          .from('game_messages')
          .insert([{
            game_id: id,
            message: prompt,
            response: "Content generated successfully",
            image_url: imageUrl || null
          }]);
          
        if (messageError) {
          console.error("Error saving initial message:", messageError);
        } else {
          setTerminalOutput(prev => [...prev, "> Initial message saved to chat"]);
        }
      }
      
      setTerminalOutput(prev => [...prev, "> Generation complete! Displaying result..."]);
      
      // Set generation as complete and load the result
      setGenerationInProgress(false);
      
      // Refresh game data to show the generated content
      fetchGame();
      
      // Remove the generating parameter from URL
      navigate(`/play/${id}`, { replace: true });
      
      toast({
        title: "Generation complete!",
        description: "Your content has been generated successfully."
      });
      
    } catch (error) {
      console.error('Generation error:', error);
      
      setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : "Generation failed"}`]);
      setTerminalOutput(prev => [...prev, "> Attempting to recover..."]);
      
      // Even if there's an error, try to load the game
      fetchGame();
      
      toast({
        title: "Error generating content",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

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
        
        // If the code is no longer "Generating...", hide the generation UI
        if (sortedVersions[0].code !== "Generating...") {
          setShowGenerating(false);
          setGenerationInProgress(false);
        }
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
        // Wait for document to be fully loaded
        document.addEventListener('DOMContentLoaded', function() {
          console.log('DOM fully loaded, setting up UI enhancements');
          
          // Fix for anchor tag scrolling
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
          
          // Generic tab functionality fix
          // This handles multiple common tab patterns
          
          // Type 1: data-tab based tabs
          const setupDataTabs = function() {
            const tabs = document.querySelectorAll('[data-tab]');
            if (tabs.length > 0) {
              console.log('Found data-tab tabs:', tabs.length);
              tabs.forEach(tab => {
                tab.addEventListener('click', function() {
                  const target = this.getAttribute('data-tab');
                  
                  // Hide all tab content
                  document.querySelectorAll('[data-tab-content]').forEach(content => {
                    content.style.display = 'none';
                  });
                  
                  // Show selected tab content
                  if (target) {
                    const targetContent = document.querySelector('[data-tab-content="' + target + '"]');
                    if (targetContent) {
                      targetContent.style.display = 'block';
                    }
                  }
                  
                  // Update active state
                  tabs.forEach(t => t.classList.remove('active'));
                  this.classList.add('active');
                });
              });
              
              // Activate first tab by default if none is active
              if (!document.querySelector('[data-tab].active')) {
                const firstTab = document.querySelector('[data-tab]');
                if (firstTab) {
                  firstTab.click();
                }
              }
            }
          };
          
          // Type 2: aria-based tabs
          const setupAriaTabs = function() {
            const tabButtons = document.querySelectorAll('[role="tab"]');
            if (tabButtons.length > 0) {
              console.log('Found ARIA tabs:', tabButtons.length);
              tabButtons.forEach(button => {
                button.addEventListener('click', function() {
                  const controls = this.getAttribute('aria-controls');
                  const tablist = this.closest('[role="tablist"]');
                  
                  if (tablist) {
                    // Deactivate all tabs
                    tablist.querySelectorAll('[role="tab"]').forEach(tab => {
                      tab.setAttribute('aria-selected', 'false');
                      tab.classList.remove('active');
                    });
                    
                    // Activate this tab
                    this.setAttribute('aria-selected', 'true');
                    this.classList.add('active');
                    
                    // Hide all tab panels
                    document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
                      panel.setAttribute('hidden', '');
                      panel.style.display = 'none';
                    });
                    
                    // Show the selected panel
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
              
              // Activate first tab by default if none is selected
              const tablist = document.querySelector('[role="tablist"]');
              if (tablist && !tablist.querySelector('[aria-selected="true"]')) {
                const firstTab = tablist.querySelector('[role="tab"]');
                if (firstTab) {
                  firstTab.click();
                }
              }
            }
          };
          
          // Type 3: Class-based tabs (common pattern)
          const setupClassTabs = function() {
            const tabButtons = document.querySelectorAll('.tabs .tab, .tab-list .tab, .tabs-nav .tab-link');
            if (tabButtons.length > 0) {
              console.log('Found class-based tabs:', tabButtons.length);
              tabButtons.forEach(button => {
                button.addEventListener('click', function(e) {
                  e.preventDefault();
                  
                  // Try to get target from href or data attribute
                  let target = this.getAttribute('href');
                  if (!target || !target.startsWith('#')) {
                    target = this.dataset.target || this.dataset.href;
                  } else {
                    target = target.substring(1); // Remove the # from href
                  }
                  
                  // Find tab container (parent or grandparent)
                  const tabContainer = this.closest('.tabs, .tab-container, .tabs-wrapper');
                  
                  if (tabContainer) {
                    // Deactivate all tabs
                    tabContainer.querySelectorAll('.tab, .tab-link').forEach(tab => {
                      tab.classList.remove('active');
                    });
                    
                    // Activate this tab
                    this.classList.add('active');
                    
                    // Hide all content panels in this container
                    tabContainer.querySelectorAll('.tab-content, .tab-pane, .tabs-content > div').forEach(panel => {
                      panel.style.display = 'none';
                      panel.classList.remove('active');
                    });
                    
                    // Show the selected panel
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
              
              // Activate first tab by default if none is active
              const tabContainer = document.querySelector('.tabs, .tab-container, .tabs-wrapper');
              if (tabContainer && !tabContainer.querySelector('.tab.active, .tab-link.active')) {
                const firstTab = tabContainer.querySelector('.tab, .tab-link');
                if (firstTab) {
                  firstTab.click();
                }
              }
            }
          };
          
          // Run all tab setup functions
          setupDataTabs();
          setupAriaTabs();
          setupClassTabs();
          
          // Final catch-all for any click events that might need to be triggered
          setTimeout(() => {
            document.querySelectorAll('.tabs .active, [role="tab"][aria-selected="true"], [data-tab].active')
              .forEach(activeTab => {
                console.log('Triggering click on already active tab to ensure content is visible');
                activeTab.click();
              });
            
            // Dispatch resize event to fix any responsive elements
            window.dispatchEvent(new Event('resize'));
          }, 300);
        });

        // Also run setup on load for any dynamically loaded content
        window.addEventListener('load', function() {
          console.log('Window loaded, re-running tab initialization');
          // Force a resize event in case any responsive elements need to adjust
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
            {!showGenerating && currentVersion && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-sm"
                onClick={handleDownload}
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
                    open={true}
                    onOpenChange={() => {}}
                    output={terminalOutput}
                    thinkingTime={thinkingTime}
                    loading={generationInProgress}
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
