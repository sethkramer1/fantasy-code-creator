
import React, { useRef, useEffect, forwardRef } from "react";

interface IframePreviewProps {
  code: string;
  selectedFont?: string;
}

export const IframePreview = forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code, selectedFont }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    
    useEffect(() => {
      if (!ref) return;
      
      if (typeof ref === 'function') {
        ref(localIframeRef.current);
      } else {
        ref.current = localIframeRef.current;
      }
    }, [ref]);

    // This effect triggers when code or selectedFont changes
    useEffect(() => {
      console.log("IframePreview update - Font:", selectedFont);
      if (localIframeRef.current) {
        // Update the iframe's content when font or code changes
        const doc = localIframeRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(prepareIframeContent(code));
          doc.close();
        }
        localIframeRef.current.focus();
      }
    }, [code, selectedFont]);

    const prepareIframeContent = (html: string) => {
      // Add font style if one is selected
      const fontStyle = selectedFont ? 
        `<style>
          body, pre, code, textarea, input, button, select, option {
            font-family: ${selectedFont} !important;
          }
        </style>` : '';

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
        return html.replace('<head>', '<head>' + fontStyle + helperScript);
      } else if (html.includes('<html')) {
        return html.replace(/<html[^>]*>/, '$&<head>' + fontStyle + helperScript + '</head>');
      } else {
        return fontStyle + helperScript + html;
      }
    };

    return (
      <div 
        className="h-full relative"
        onClick={() => localIframeRef.current?.focus()}
      >
        <iframe
          ref={localIframeRef}
          srcDoc={prepareIframeContent(code)}
          className="absolute inset-0 w-full h-full border border-gray-100"
          sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
          title="Generated Content"
          tabIndex={0}
          onLoad={() => console.log("Iframe content loaded with font:", selectedFont)}
        />
      </div>
    );
  }
);

IframePreview.displayName = "IframePreview";
