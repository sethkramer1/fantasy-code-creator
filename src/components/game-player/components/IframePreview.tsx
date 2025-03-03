
import React, { useRef, useEffect, forwardRef, useState } from "react";

interface IframePreviewProps {
  code: string;
  selectedFont: string;
  onCodeChange?: (newCode: string) => void;
}

export const IframePreview = forwardRef<HTMLIFrameElement, IframePreviewProps>(
  ({ code, selectedFont, onCodeChange }, ref) => {
    const localIframeRef = useRef<HTMLIFrameElement>(null);
    const [selectedText, setSelectedText] = useState<{ text: string, range: Range | null }>({ text: "", range: null });
    
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
          
          // Set up selection event listeners
          setupSelectionListeners(doc);
        }
        localIframeRef.current.focus();
      }
    }, [code, selectedFont]);
    
    // Setup selection listeners in the iframe
    const setupSelectionListeners = (doc: Document) => {
      doc.addEventListener('selectionchange', () => {
        const selection = doc.getSelection();
        if (selection && selection.toString().trim() !== '') {
          setSelectedText({ text: selection.toString(), range: selection.getRangeAt(0) });
        } else {
          setSelectedText({ text: "", range: null });
        }
      });
      
      // Prevent selection from being lost when dropdown is clicked
      doc.addEventListener('mouseup', (e) => {
        e.stopPropagation();
      });
    };
    
    // Apply font to selected text
    const applyFontToSelection = () => {
      if (!selectedText.range || !selectedText.text || !localIframeRef.current) return;
      
      const doc = localIframeRef.current.contentDocument;
      if (!doc) return;
      
      try {
        // Create a span with the selected font
        const span = doc.createElement('span');
        span.style.fontFamily = selectedFont;
        
        // Wrap the selection with the span
        selectedText.range.surroundContents(span);
        
        // Extract and update the modified HTML
        const updatedHtml = doc.documentElement.outerHTML;
        
        // Pass the updated code back to parent
        if (onCodeChange) {
          onCodeChange(updatedHtml);
        }
        
        // Reset selection
        setSelectedText({ text: "", range: null });
      } catch (e) {
        console.error("Error applying font to selection:", e);
      }
    };

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
            
            // Track font changes from parent window
            window.addEventListener('message', function(event) {
              if (event.data && event.data.type === 'applyFontToSelection') {
                const selection = document.getSelection();
                if (selection && selection.rangeCount > 0) {
                  try {
                    const range = selection.getRangeAt(0);
                    const span = document.createElement('span');
                    span.style.fontFamily = event.data.font;
                    range.surroundContents(span);
                    
                    // Notify parent the HTML has changed
                    window.parent.postMessage({
                      type: 'htmlUpdated',
                      html: document.documentElement.outerHTML
                    }, '*');
                  } catch(e) {
                    console.error('Error applying font:', e);
                  }
                }
              }
            });
            
            // Setup other UI enhancements
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
        onClick={() => {
          if (selectedText.text && selectedText.range) {
            applyFontToSelection();
          } else {
            localIframeRef.current?.focus();
          }
        }}
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
        
        {selectedText.text && (
          <div className="absolute bottom-3 left-3 z-10 bg-gray-800/90 text-white text-xs px-3 py-1.5 rounded-md">
            Text selected: {selectedText.text.slice(0, 20)}{selectedText.text.length > 20 ? '...' : ''}
          </div>
        )}
      </div>
    );
  }
);

IframePreview.displayName = "IframePreview";
