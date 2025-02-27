
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, History, RotateCcw, Download } from "lucide-react";
import { GameChat } from "@/components/GameChat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import JSZip from 'jszip';
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';

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
  const [showCode, setShowCode] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  // Get current version early to prevent TS errors
  const currentVersion = gameVersions.find(v => v.id === selectedVersion);
  const selectedVersionNumber = currentVersion?.version_number;
  const isLatestVersion = selectedVersionNumber === gameVersions[0]?.version_number;

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

        // Patch the CanvasGradient.addColorStop method to prevent non-finite value errors
        (function() {
          if (window.CanvasGradient) {
            const originalAddColorStop = CanvasGradient.prototype.addColorStop;
            
            CanvasGradient.prototype.addColorStop = function(offset, color) {
              // Validate offset is a finite number between 0 and 1
              if (typeof offset !== 'number' || !isFinite(offset) || offset < 0 || offset > 1) {
                console.warn('Invalid gradient offset:', offset, '- Using 0 instead');
                offset = 0; // Use a safe default value
              }
              
              try {
                originalAddColorStop.call(this, offset, color);
              } catch (e) {
                console.warn('Error in addColorStop:', e.message);
                // Try with fallback values if original call fails
                try {
                  originalAddColorStop.call(this, 0, 'rgba(0,0,0,0)');
                } catch (fallbackError) {
                  // Silent fail - we tried our best
                }
              }
            };
          }
        })();
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
        title: "Code updated successfully",
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

  // Improved download image function with better error handling
  const downloadGameAsImage = async () => {
    if (!currentVersion || !currentVersion.code) {
      toast({
        title: "Cannot download",
        description: "This game doesn't have any code to render",
        variant: "destructive"
      });
      return;
    }

    try {
      setDownloadingPng(true);

      // Add safety script to handle gradient issues before rendering
      const safetyScript = `
        <script>
          // Patch canvas gradient methods to prevent non-finite value errors
          if (window.CanvasGradient) {
            const originalAddColorStop = CanvasGradient.prototype.addColorStop;
            CanvasGradient.prototype.addColorStop = function(offset, color) {
              if (!isFinite(offset)) {
                console.warn("Fixing non-finite gradient offset:", offset);
                offset = 0;
              }
              if (offset < 0) offset = 0;
              if (offset > 1) offset = 1;
              try {
                return originalAddColorStop.call(this, offset, color);
              } catch (e) {
                console.warn("Gradient error:", e);
                return originalAddColorStop.call(this, 0, "rgba(0,0,0,0)");
              }
            };
          }

          // Patch other potentially problematic canvas methods
          if (window.CanvasRenderingContext2D) {
            const safelyWrapMethod = (obj, methodName) => {
              const original = obj.prototype[methodName];
              obj.prototype[methodName] = function(...args) {
                try {
                  // Check for NaN, Infinity in numeric arguments
                  const safeArgs = args.map(arg => 
                    (typeof arg === 'number' && !isFinite(arg)) ? 0 : arg
                  );
                  return original.apply(this, safeArgs);
                } catch (e) {
                  console.warn(\`Error in \${methodName}:\`, e);
                  // Return safely
                  return this;
                }
              };
            };
            
            // Wrap methods that commonly cause issues
            ['arc', 'arcTo', 'bezierCurveTo', 'ellipse', 'lineTo', 'moveTo', 
             'quadraticCurveTo', 'rect', 'setTransform', 'transform', 'translate',
             'scale', 'rotate', 'setLineDash'].forEach(method => {
              if (CanvasRenderingContext2D.prototype[method]) {
                safelyWrapMethod(CanvasRenderingContext2D, method);
              }
            });
          }
        </script>
      `;

      // Create a temporary iframe to render the code
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '1200px';
      iframe.style.height = '100vh';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-1000';
      iframe.style.opacity = '0';
      
      document.body.appendChild(iframe);
      
      // Wait for iframe to load with safety measures injected
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        
        // Modify content to inject safety scripts
        let contentWithSafety = currentVersion.code;
        if (contentWithSafety.includes('<head>')) {
          contentWithSafety = contentWithSafety.replace('<head>', '<head>' + safetyScript);
        } else if (contentWithSafety.includes('<html')) {
          contentWithSafety = contentWithSafety.replace(/<html[^>]*>/, '$&<head>' + safetyScript + '</head>');
        } else {
          contentWithSafety = safetyScript + contentWithSafety;
        }
        
        // Write content to iframe
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(contentWithSafety);
          doc.close();
        }
      });

      // Let content render for a moment
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Apply additional protective measures before capturing
      if (iframe.contentDocument && iframe.contentWindow) {
        try {
          const safetyCode = `
            // Remove any problematic elements or styles that might cause canvas issues
            const fixCanvas = () => {
              // Fix any canvas gradients with bad values
              const canvases = document.querySelectorAll('canvas');
              canvases.forEach(canvas => {
                try {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    // Force redraw with safe values if needed
                    const oldFillStyle = ctx.fillStyle;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, 1, 1);
                    ctx.fillStyle = oldFillStyle;
                  }
                } catch (e) {
                  console.warn('Canvas fixup error:', e);
                }
              });
              
              // Handle CSS gradients in computed styles
              document.querySelectorAll('*').forEach(el => {
                try {
                  const style = window.getComputedStyle(el);
                  const bgImage = style.backgroundImage;
                  
                  // Replace problematic gradients with solid colors
                  if (bgImage && bgImage.includes('gradient') && 
                      (bgImage.includes('NaN') || bgImage.includes('Infinity'))) {
                    el.style.backgroundImage = 'none';
                    el.style.backgroundColor = '#ffffff';
                  }
                } catch (e) {
                  // Ignore style access errors
                }
              });
            };
            
            fixCanvas();
            return true;
          `;
          
          // Execute safety code in iframe
          iframe.contentWindow.eval(safetyCode);
        } catch (e) {
          console.warn('Error applying pre-capture fixes:', e);
        }
      }
      
      // Capture iframe content with enhanced error handling
      if (iframe.contentDocument?.body) {
        try {
          // Get actual content height
          const contentHeight = Math.max(
            iframe.contentDocument.body.scrollHeight || 0,
            iframe.contentDocument.documentElement.scrollHeight || 0,
            iframe.contentDocument.body.offsetHeight || 0,
            iframe.contentDocument.documentElement.offsetHeight || 0,
            600 // Minimum fallback height
          );
          
          // Update iframe height to match content
          iframe.style.height = `${contentHeight}px`;
          
          // Allow time for resize to take effect
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Create canvas with appropriate dimensions using safe options
          const canvas = await html2canvas(iframe.contentDocument.body, {
            width: 1200,
            height: contentHeight,
            windowWidth: 1200,
            windowHeight: contentHeight,
            scale: 2, // Higher quality
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 0,
            onclone: (clonedDoc) => {
              try {
                // Additional safety measures for the cloned document
                const safetyScript = clonedDoc.createElement('script');
                safetyScript.textContent = `
                  // Find and fix any problematic canvas operations or gradients
                  document.querySelectorAll('canvas').forEach(canvas => {
                    const ctx = canvas.getContext('2d');
                    if (ctx && ctx.createLinearGradient) {
                      const originalCreateLinearGradient = ctx.createLinearGradient;
                      ctx.createLinearGradient = function(...args) {
                        const safeArgs = args.map(arg => isFinite(arg) ? arg : 0);
                        return originalCreateLinearGradient.apply(this, safeArgs);
                      };
                    }
                  });
                `;
                clonedDoc.head.appendChild(safetyScript);
                
                // Ensure all styles are applied in the cloned document
                try {
                  const styles = Array.from(document.styleSheets);
                  styles.forEach(styleSheet => {
                    try {
                      const rules = Array.from(styleSheet.cssRules || []);
                      const style = clonedDoc.createElement('style');
                      rules.forEach(rule => {
                        try {
                          style.appendChild(document.createTextNode(rule.cssText));
                        } catch (e) {
                          // Skip problematic rules
                        }
                      });
                      clonedDoc.head.appendChild(style);
                    } catch (e) {
                      // Ignore cross-origin stylesheet errors
                    }
                  });
                } catch (e) {
                  console.warn('Style copying error:', e);
                }
              } catch (e) {
                console.warn('Clone document preparation error:', e);
              }
            }
          });
          
          // Convert canvas to data URL with maximum quality
          const imageUrl = canvas.toDataURL('image/png', 1.0);
          
          // Create download link
          const link = document.createElement('a');
          link.download = `game-version-${currentVersion.version_number}.png`;
          link.href = imageUrl;
          link.click();
          
          toast({
            title: "Image downloaded",
            description: "Your game screenshot has been downloaded as PNG"
          });
        } catch (canvasError) {
          // Try fallback method if html2canvas fails
          console.error('Primary capture method failed:', canvasError);
          
          // Fallback to simpler canvas capture with basic error handling
          toast({
            title: "Trying alternative method",
            description: "First capture attempt failed, trying another approach"
          });
          
          try {
            // Create a canvas element
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              // Draw a white background
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Add a text explanation
              ctx.fillStyle = '#000000';
              ctx.font = '20px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('Game Preview (Limited Version)', canvas.width / 2, 50);
              ctx.fillText('The game contains complex graphics that could not be fully captured', canvas.width / 2, 90);
              
              // Try to draw at least some content from the iframe if possible
              try {
                ctx.drawImage(iframe.contentDocument.body as any, 0, 120, canvas.width, canvas.height - 150);
              } catch (e) {
                // If drawing fails, add more text explanation
                ctx.fillText('Please view the game in the browser to see the full experience', canvas.width / 2, 150);
              }
              
              const imageUrl = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.download = `game-version-${currentVersion.version_number}-simple.png`;
              link.href = imageUrl;
              link.click();
              
              toast({
                title: "Simple image downloaded",
                description: "A simplified version of your game was downloaded as PNG"
              });
            }
          } catch (fallbackError) {
            console.error('Fallback capture method failed:', fallbackError);
            throw new Error('Unable to capture game image: ' + canvasError.message);
          }
        }
      }
      
      // Clean up
      document.body.removeChild(iframe);
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Download failed",
        description: "Could not generate image due to canvas rendering issues. Try exporting as ZIP instead.",
        variant: "destructive"
      });
    } finally {
      setDownloadingPng(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>;
  }

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
            {!isLatestVersion && currentVersion && (
              <button 
                onClick={() => handleRevertToVersion(currentVersion)} 
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <RotateCcw size={16} />
                <span>Revert to this version</span>
              </button>
            )}
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-sm"
                onClick={handleDownload}
              >
                <Download size={14} />
                ZIP
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-sm"
                onClick={downloadGameAsImage}
                disabled={downloadingPng}
              >
                {downloadingPng ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <Download size={14} />
                )}
                PNG
              </Button>
            </div>
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
            {currentVersion && (
              <div className="glass-panel bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 mb-4 flex-shrink-0">
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
                          <code className="text-sm whitespace-pre-wrap break-words">{currentVersion.code}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;
