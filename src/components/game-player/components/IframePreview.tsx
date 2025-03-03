import React, { useRef, useEffect, forwardRef, useState, useCallback } from "react";

interface IframePreviewProps {
  code: string;
}

export const IframePreview = forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeContent, setIframeContent] = useState<string>("");
    const prevCodeRef = useRef<string>("");
    const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Forward the ref to parent component
    useEffect(() => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(localIframeRef.current);
      } else {
        ref.current = localIframeRef.current;
      }
    }, [ref]);

    // Memoized function to prepare iframe content
    const prepareIframeContent = useCallback((html: string) => {
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
        </script>
      `;

      if (html.includes('<head>')) {
        return html.replace('<head>', '<head>' + helperScript);
      } else if (html.includes('<html')) {
        return html.replace(/<html[^>]*>/, '$&<head>' + helperScript + '</head>');
      } else {
        return helperScript + html;
      }
    }, []);

    // Update iframe content when code changes, with debounce
    useEffect(() => {
      // Clear any existing timer
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      
      // Skip if code is unchanged or too short
      if (!code || code === prevCodeRef.current || code.length < 100) {
        return;
      }
      
      console.log("IframePreview preparing to update with new code, length:", code.length);
      
      // Set a small delay to debounce updates
      updateTimerRef.current = setTimeout(() => {
        const preparedContent = prepareIframeContent(code);
        setIframeContent(preparedContent);
        prevCodeRef.current = code;
        console.log("IframePreview content updated");
      }, 300);
      
      return () => {
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
        }
      };
    }, [code, prepareIframeContent]);

    // Focus iframe when content changes
    useEffect(() => {
      if (iframeContent && localIframeRef.current) {
        localIframeRef.current.focus();
      }
    }, [iframeContent]);

    return (
      <div 
        className="h-full relative"
        onClick={() => localIframeRef.current?.focus()}
      >
        {iframeContent ? (
          <iframe
            ref={localIframeRef}
            srcDoc={iframeContent}
            className="absolute inset-0 w-full h-full border border-gray-100"
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            title="Generated Content"
            tabIndex={0}
            onLoad={() => console.log("Iframe content loaded")}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}
      </div>
    );
  }
);

IframePreview.displayName = "IframePreview";
