
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
  image_url?: string | null;
}

const Play = () => {
  const { id } = useParams();
  const [gameVersions, setGameVersions] = useState<GameVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [capturingImage, setCapturingImage] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

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
        // First try to get all fields including the new fields
        let result;
        try {
          result = await supabase.from('games').select(`
              id,
              current_version,
              game_versions (
                id,
                version_number,
                code,
                instructions,
                created_at,
                image_url
              )
            `).eq('id', id).single();
        } catch (e) {
          // If there's any error, we'll try the fallback query
          result = { error: e };
        }
        
        if (result.error) {
          // Try with a fallback query without image_url
          console.warn("Using fallback query without image_url:", result.error);
          const fallbackResult = await supabase.from('games').select(`
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
          
          if (fallbackResult.error) throw fallbackResult.error;
          if (!fallbackResult.data) throw new Error("Game not found");
          
          // Process the game versions - ensure each item is valid and add image_url: null
          const validVersions = Array.isArray(fallbackResult.data.game_versions) 
            ? fallbackResult.data.game_versions
                .filter(v => v !== null && typeof v === 'object') 
                .map(v => ({
                  id: v?.id || crypto.randomUUID(),
                  version_number: v?.version_number || 1,
                  code: v?.code || '',
                  instructions: v?.instructions || null,
                  created_at: v?.created_at || new Date().toISOString(),
                  image_url: null
                }))
            : [];
          
          const sortedVersions = validVersions.sort((a, b) => b.version_number - a.version_number);
          setGameVersions(sortedVersions);
          
          if (sortedVersions.length > 0) {
            setSelectedVersion(sortedVersions[0].id);
            console.log("Selected latest version:", sortedVersions[0].version_number);
          }
        } else {
          if (!result.data) throw new Error("Game not found");
          
          // Process the game versions
          const validVersions = Array.isArray(result.data.game_versions) 
            ? result.data.game_versions
                .filter(v => v !== null && typeof v === 'object')
                .map(v => ({
                  id: v?.id || crypto.randomUUID(),
                  version_number: v?.version_number || 1,
                  code: v?.code || '',
                  instructions: v?.instructions || null,
                  created_at: v?.created_at || new Date().toISOString(),
                  image_url: v?.image_url || null
                }))
            : [];
          
          const sortedVersions = validVersions.sort((a, b) => b.version_number - a.version_number);
          setGameVersions(sortedVersions);
          
          if (sortedVersions.length > 0) {
            setSelectedVersion(sortedVersions[0].id);
            console.log("Selected latest version:", sortedVersions[0].version_number);
          }
        }
      } catch (error) {
        console.error("Error loading game:", error);
        toast({
          title: "Error loading game",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchGame();
    } else {
      setLoading(false);
    }
  }, [id, toast]);

  const prepareIframeContent = (html: string) => {
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
              
              if (!document.querySelector('[role="tablist"][aria-selected="true"]')) {
                const firstTab = document.querySelector('[role="tab"]');
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
              
              if (!document.querySelector('.tabs, .tab-container, .tabs-wrapper .tab.active, .tabs, .tab-container, .tabs-wrapper .tab-link.active')) {
                const firstTab = document.querySelector('.tabs, .tab-container, .tabs-wrapper .tab, .tabs, .tab-container, .tabs-wrapper .tab-link');
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

        (function() {
          if (window.CanvasGradient) {
            const originalAddColorStop = CanvasGradient.prototype.addColorStop;
            
            CanvasGradient.prototype.addColorStop = function(offset, color) {
              if (typeof offset !== 'number' || !isFinite(offset) || offset < 0 || offset > 1) {
                console.warn('Invalid gradient offset:', offset, '- Using 0 instead');
                offset = 0;
              }
              
              try {
                originalAddColorStop.call(this, offset, color);
              } catch (e) {
                console.warn('Error in addColorStop:', e.message);
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

    if (html.includes('<head>')) {
      return html.replace('<head>', '<head>' + helperScript);
    } else if (html.includes('<html')) {
      return html.replace(/<html[^>]*>/, '$&<head>' + helperScript + '</head>');
    } else {
      return helperScript + html;
    }
  };

  useEffect(() => {
    if (!loading && iframeRef.current) {
      iframeRef.current.focus();
      
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

  // Capture a screenshot of the iframe content and upload it to Supabase
  const captureAndSaveImage = async (): Promise<string | null> => {
    if (!iframeRef.current) return null;
    
    setCapturingImage(true);
    try {
      // Use a similar approach to downloadGameAsImage but with storage upload
      const safetyScript = `
        <script>
          if (window.CanvasGradient) {
            const originalAddColorStop = CanvasGradient.prototype.addColorStop;
            CanvasGradient.prototype.addColorStop = function(offset, color) {
              if (typeof offset === 'number' && !isFinite(offset)) {
                offset = offset < 0 ? 0 : (offset > 0 ? 1 : 0);
                console.warn("Fixed non-finite gradient offset");
              }
              try {
                return originalAddColorStop.call(this, offset, color);
              } catch (e) {
                console.warn("Handled gradient error:", e.message);
                try {
                  let safeOffset = typeof offset === 'number' ? Math.max(0, Math.min(1, offset)) : 0;
                  return originalAddColorStop.call(this, safeOffset, color || 'rgba(0,0,0,0.01)');
                } catch (fallbackError) {
                  console.warn("Using last resort gradient fallback");
                }
              }
            };
          }
        </script>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '800px';
      iframe.style.height = '600px';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-1000';
      iframe.style.opacity = '0';
      
      document.body.appendChild(iframe);
      
      // Load iframe content
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        
        const contentWithSafety = currentVersion?.code || '';
        const enhancedContent = contentWithSafety.includes('<head>') 
          ? contentWithSafety.replace('<head>', '<head>' + safetyScript)
          : (contentWithSafety.includes('<html') 
              ? contentWithSafety.replace(/<html[^>]*>/, '$&<head>' + safetyScript + '</head>')
              : safetyScript + contentWithSafety);
        
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(enhancedContent);
          doc.close();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 800));

      // Apply fixes to iframe content
      if (iframe.contentDocument && iframe.contentWindow) {
        try {
          const script = iframe.contentDocument.createElement('script');
          script.textContent = `
            const findAndFixGradientIssues = () => {
              const canvases = document.querySelectorAll('canvas');
              canvases.forEach(canvas => {
                try {
                  const ctx = canvas.getContext('2d');
                  if (ctx && ctx.createLinearGradient) {
                    const originalCreateLinearGradient = ctx.createLinearGradient;
                    ctx.createLinearGradient = function(x0, y0, x1, y1) {
                      if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) {
                        x0 = isFinite(x0) ? x0 : 0;
                        y0 = isFinite(y0) ? y0 : 0;
                        x1 = isFinite(x1) ? x1 : canvas.width || 100;
                        y1 = isFinite(y1) ? y1 : canvas.height || 100;
                      }
                      return originalCreateLinearGradient.call(this, x0, y0, x1, y1);
                    };
                  }
                } catch (e) {
                  console.warn('Canvas prep error:', e);
                }
              });
            };
            
            findAndFixGradientIssues();
          `;
          iframe.contentDocument.head.appendChild(script);
        } catch (e) {
          console.warn('Error applying pre-capture fixes:', e);
        }
      }

      // Capture the content as an image
      if (iframe.contentDocument?.body) {
        const contentHeight = Math.max(
          iframe.contentDocument.body.scrollHeight || 0,
          iframe.contentDocument.documentElement.scrollHeight || 0,
          iframe.contentDocument.body.offsetHeight || 0,
          iframe.contentDocument.documentElement.offsetHeight || 0,
          600
        );
        
        iframe.style.height = `${contentHeight}px`;
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        try {
          const canvas = await html2canvas(iframe.contentDocument.body, {
            width: 800,
            height: Math.min(contentHeight, 600),
            windowWidth: 800,
            windowHeight: Math.min(contentHeight, 600),
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false,
            imageTimeout: 15000,
          });
          
          // Convert canvas to blob
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png', 0.85);
          });
          
          if (!blob) throw new Error("Failed to create image blob");
          
          // Create a file object from the blob
          const file = new File([blob], `game-${id}-v${selectedVersionNumber}.png`, { type: 'image/png' });
          
          // Upload to Supabase storage - handle the case where the bucket might not exist yet
          try {
            const { data, error } = await supabase.storage
              .from('game-thumbnails')
              .upload(`games/${id}/${Date.now()}-v${selectedVersionNumber}.png`, file, {
                cacheControl: '3600',
                upsert: false
              });
              
            if (error) {
              if (error.message.includes('The resource already exists')) {
                const uniquePath = `games/${id}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}-v${selectedVersionNumber}.png`;
                const { data: retryData, error: retryError } = await supabase.storage
                  .from('game-thumbnails')
                  .upload(uniquePath, file, {
                    cacheControl: '3600',
                    upsert: false
                  });
                  
                if (retryError) throw retryError;
                
                // Get public URL
                const { data: urlData } = supabase.storage
                  .from('game-thumbnails')
                  .getPublicUrl(retryData?.path || uniquePath);
                  
                document.body.removeChild(iframe);
                return urlData.publicUrl;
              }
              
              // If the bucket doesn't exist, just return null
              if (error.message.includes('bucket') || error.message.includes('does not exist')) {
                console.error('Storage bucket issue:', error.message);
                document.body.removeChild(iframe);
                return null;
              }
              
              throw error;
            }
            
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('game-thumbnails')
              .getPublicUrl(data?.path || `games/${id}/${Date.now()}-v${selectedVersionNumber}.png`);
              
            document.body.removeChild(iframe);
            return urlData.publicUrl;
          } catch (storageError) {
            console.error('Storage error:', storageError);
            // If there's a storage error, we'll just return null
            document.body.removeChild(iframe);
            return null;
          }
          
        } catch (canvasError) {
          console.error('Image capture error:', canvasError);
          document.body.removeChild(iframe);
          throw canvasError;
        }
      }
      
      document.body.removeChild(iframe);
      return null;
      
    } catch (error) {
      console.error('Error capturing image:', error);
      toast({
        title: "Image capture failed",
        description: "Could not generate a thumbnail for this version",
        variant: "destructive"
      });
      return null;
    } finally {
      setCapturingImage(false);
    }
  };

  const handleGameUpdate = async (newCode: string, newInstructions: string) => {
    try {
      setLoading(true);
      const newVersionNumber = gameVersions.length > 0 ? gameVersions[0].version_number + 1 : 1;
      
      // First create the new version, handle the case where image_url column might not exist
      try {
        const versionData = {
          game_id: id,
          version_number: newVersionNumber,
          code: newCode,
          instructions: newInstructions
        };
        
        const { data: newVersionData, error: versionError } = await supabase
          .from('game_versions')
          .insert(versionData)
          .select()
          .single();
          
        if (versionError) throw versionError;
        if (!newVersionData) throw new Error("Failed to save new version");
        
        // Update the games table, handle the case where thumbnail_url column might not exist
        try {
          const { error: gameError } = await supabase
            .from('games')
            .update({ 
              current_version: newVersionNumber,
              code: newCode,
              instructions: newInstructions
            })
            .eq('id', id);
            
          if (gameError) throw gameError;
        } catch (updateError) {
          console.error("Error updating game:", updateError);
          // If there's an error updating, we'll continue anyway
        }
        
        // Set the new version as the selected one
        const newVersion: GameVersion = {
          id: newVersionData.id,
          version_number: newVersionData.version_number,
          code: newVersionData.code,
          instructions: newVersionData.instructions,
          created_at: newVersionData.created_at,
          image_url: null
        };
        
        setGameVersions(prev => [newVersion, ...prev]);
        setSelectedVersion(newVersion.id);
        setShowCode(false);
        
        // After we have a new version and it's selected, wait a bit for the iframe to render
        // before capturing the image
        setTimeout(async () => {
          try {
            // Capture and save an image of the new version
            const imageUrl = await captureAndSaveImage();
            
            if (imageUrl) {
              try {
                // Try to update with image_url - will fail silently if column doesn't exist
                try {
                  await supabase
                    .from('game_versions')
                    .update({
                      image_url: imageUrl
                    } as any)
                    .eq('id', newVersion.id);
                } catch (updateImageError) {
                  console.warn("Could not update image_url on game_versions", updateImageError);
                }
                
                // Try to update with thumbnail_url - will fail silently if column doesn't exist
                try {
                  await supabase
                    .from('games')
                    .update({
                      thumbnail_url: imageUrl
                    } as any)
                    .eq('id', id);
                } catch (updateThumbnailError) {
                  console.warn("Could not update thumbnail_url on games", updateThumbnailError);
                }
                
                // Update the local state regardless of DB updates
                setGameVersions(prev => prev.map(v => 
                  v.id === newVersion.id ? { ...v, image_url: imageUrl } : v
                ));
              } catch (updateImageError) {
                console.error("Error updating image URLs:", updateImageError);
                // If there's an error updating image URLs, we'll continue anyway
              }
            }
          } catch (error) {
            console.error("Error capturing version image:", error);
          }
        }, 1500);
        
        toast({
          title: "Code updated successfully",
          description: `Version ${newVersionNumber} has been created and set as current.`
        });
      } catch (insertError) {
        console.error("Error creating version:", insertError);
        throw insertError;
      }
      
    } catch (error) {
      console.error("Error saving new version:", error);
      toast({
        title: "Error saving version",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersion(versionId);
  };

  const handleRevertToVersion = async (version: GameVersion) => {
    try {
      const newVersion: GameVersion = {
        id: crypto.randomUUID(),
        version_number: gameVersions.length > 0 ? gameVersions[0].version_number + 1 : 1,
        code: version.code,
        instructions: version.instructions,
        created_at: new Date().toISOString(),
        image_url: version.image_url
      };
      
      // Insert the new version with proper types
      const versionData = {
        id: newVersion.id,
        game_id: id,
        version_number: newVersion.version_number,
        code: newVersion.code,
        instructions: newVersion.instructions
      };
      
      // Only add image_url if it exists
      if (version.image_url) {
        // Use as any to bypass TypeScript error
        try {
          await supabase
            .from('game_versions')
            .insert({
              ...versionData,
              image_url: version.image_url
            } as any);
        } catch (e) {
          // If that fails, try without image_url
          console.warn("Error inserting with image_url, trying without:", e);
          await supabase
            .from('game_versions')
            .insert(versionData);
        }
      } else {
        await supabase
          .from('game_versions')
          .insert(versionData);
      }
      
      // Update the games table
      const updateData = {
        current_version: newVersion.version_number,
        code: newVersion.code,
        instructions: newVersion.instructions
      };
      
      // Only add thumbnail_url if image_url exists
      if (version.image_url) {
        try {
          await supabase
            .from('games')
            .update({
              ...updateData,
              thumbnail_url: version.image_url
            } as any)
            .eq('id', id);
        } catch (e) {
          // If that fails, try without thumbnail_url
          console.warn("Error updating with thumbnail_url, trying without:", e);
          await supabase
            .from('games')
            .update(updateData)
            .eq('id', id);
        }
      } else {
        await supabase
          .from('games')
          .update(updateData)
          .eq('id', id);
      }
      
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

      const safetyScript = `
        <script>
          if (window.CanvasGradient) {
            const originalAddColorStop = CanvasGradient.prototype.addColorStop;
            CanvasGradient.prototype.addColorStop = function(offset, color) {
              if (typeof offset === 'number' && !isFinite(offset)) {
                offset = offset < 0 ? 0 : (offset > 0 ? 1 : 0);
                console.warn("Fixed non-finite gradient offset");
              }
              try {
                return originalAddColorStop.call(this, offset, color);
              } catch (e) {
                console.warn("Handled gradient error:", e.message);
                try {
                  let safeOffset = typeof offset === 'number' ? Math.max(0, Math.min(1, offset)) : 0;
                  return originalAddColorStop.call(this, safeOffset, color || 'rgba(0,0,0,0.01)');
                } catch (fallbackError) {
                  console.warn("Using last resort gradient fallback");
                }
              }
            };
          }
        </script>
      `;

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
      
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        
        let contentWithSafety = currentVersion.code;
        if (contentWithSafety.includes('<head>')) {
          contentWithSafety = contentWithSafety.replace('<head>', '<head>' + safetyScript);
        } else if (contentWithSafety.includes('<html')) {
          contentWithSafety = contentWithSafety.replace(/<html[^>]*>/, '$&<head>' + safetyScript + '</head>');
        } else {
          contentWithSafety = safetyScript + contentWithSafety;
        }
        
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(contentWithSafety);
          doc.close();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 800));

      if (iframe.contentDocument && iframe.contentWindow) {
        try {
          const script = iframe.contentDocument.createElement('script');
          script.textContent = `
            const findAndFixGradientIssues = () => {
              const canvases = document.querySelectorAll('canvas');
              canvases.forEach(canvas => {
                try {
                  const ctx = canvas.getContext('2d');
                  if (ctx && ctx.createLinearGradient) {
                    const originalCreateLinearGradient = ctx.createLinearGradient;
                    ctx.createLinearGradient = function(x0, y0, x1, y1) {
                      if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) {
                        x0 = isFinite(x0) ? x0 : 0;
                        y0 = isFinite(y0) ? y0 : 0;
                        x1 = isFinite(x1) ? x1 : canvas.width || 100;
                        y1 = isFinite(y1) ? y1 : canvas.height || 100;
                      }
                      return originalCreateLinearGradient.call(this, x0, y0, x1, y1);
                    };
                  }
                } catch (e) {
                  console.warn('Canvas prep error:', e);
                }
              });
            };
            
            findAndFixGradientIssues();
          `;
          iframe.contentDocument.head.appendChild(script);
        } catch (e) {
          console.warn('Error applying pre-capture fixes:', e);
        }
      }
      
      if (iframe.contentDocument?.body) {
        try {
          const contentHeight = Math.max(
            iframe.contentDocument.body.scrollHeight || 0,
            iframe.contentDocument.documentElement.scrollHeight || 0,
            iframe.contentDocument.body.offsetHeight || 0,
            iframe.contentDocument.documentElement.offsetHeight || 0,
            600
          );
          
          iframe.style.height = `${contentHeight}px`;
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const canvas = await html2canvas(iframe.contentDocument.body, {
            width: 1200,
            height: contentHeight,
            windowWidth: 1200,
            windowHeight: contentHeight,
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false,
            imageTimeout: 15000,
            onclone: (clonedDoc) => {
              try {
                Array.from(document.styleSheets).forEach(styleSheet => {
                  try {
                    if (styleSheet.href) {
                      const link = clonedDoc.createElement('link');
                      link.rel = 'stylesheet';
                      link.href = styleSheet.href;
                      clonedDoc.head.appendChild(link);
                    } else if (styleSheet.cssRules) {
                      const style = clonedDoc.createElement('style');
                      Array.from(styleSheet.cssRules).forEach(rule => {
                        try {
                          style.appendChild(document.createTextNode(rule.cssText));
                        } catch (e) {
                          // Skip problematic rules
                        }
                      });
                      clonedDoc.head.appendChild(style);
                    }
                  } catch (e) {
                    // CORS issues with some stylesheets can be ignored
                  }
                });
              } catch (e) {
                console.warn('Style copying error:', e);
              }
            }
          });
          
          const imageUrl = canvas.toDataURL('image/png', 1.0);
          
          const link = document.createElement('a');
          link.download = `game-version-${currentVersion.version_number}.png`;
          link.href = imageUrl;
          link.click();
          
          toast({
            title: "Image downloaded",
            description: "Your game screenshot has been downloaded as PNG"
          });
        } catch (canvasError) {
          console.error('Primary capture method failed:', canvasError);
          toast({
            title: "Error with high-quality capture",
            description: "Trying a simpler approach for the download"
          });
          
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              const rect = iframe.getBoundingClientRect();
              canvas.width = rect.width;
              canvas.height = rect.height;
              
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              const image = new Image();
              image.crossOrigin = 'anonymous';
              
              const contentCanvas = await html2canvas(iframe.contentDocument.body, {
                width: rect.width,
                height: rect.height,
                scale: 1,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                imageTimeout: 5000,
                onclone: (doc) => {
                  const script = doc.createElement('script');
                  script.textContent = 'console.log("Fallback capture");';
                  doc.head.appendChild(script);
                }
              });
              
              ctx.drawImage(contentCanvas, 0, 0);
              
              const imageUrl = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.download = `game-version-${currentVersion.version_number}.png`;
              link.href = imageUrl;
              link.click();
              
              toast({
                title: "Image downloaded (simple version)",
                description: "A simplified version of your game was downloaded as PNG"
              });
            }
          } catch (fallbackError) {
            console.error('Fallback capture method failed:', fallbackError);
            throw new Error('Unable to capture game image: ' + canvasError.message);
          }
        }
      }
      
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
