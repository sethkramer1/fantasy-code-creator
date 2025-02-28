
import { useRef, useEffect } from "react";

interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}

interface GamePreviewProps {
  currentVersion: GameVersion | undefined;
  showCode: boolean;
}

export function GamePreview({ currentVersion, showCode }: GamePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.focus();
    }
  }, [currentVersion]);

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

  if (!showCode) {
    return (
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
    );
  } else {
    return (
      <div className="h-full relative">
        <div className="absolute inset-0 overflow-auto">
          <pre className="p-4 bg-gray-50 rounded-lg h-full">
            <code className="text-sm whitespace-pre-wrap break-words">{currentVersion?.code}</code>
          </pre>
        </div>
      </div>
    );
  }
}
