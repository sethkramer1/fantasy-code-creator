import { useRef, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, FileText, Pencil } from "lucide-react";

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

function parseCodeSections(code: string = "") {
  const htmlParts: string[] = [];
  const cssParts: string[] = [];
  const jsParts: string[] = [];
  
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(code)) !== null) {
    cssParts.push(styleMatch[1]);
  }
  
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(code)) !== null) {
    jsParts.push(scriptMatch[1]);
  }
  
  let htmlContent = code
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .trim();
  
  htmlParts.push(htmlContent);
  
  return {
    html: htmlParts.join('\n\n'),
    css: cssParts.join('\n\n'),
    js: jsParts.join('\n\n')
  };
}

const CodeWithLineNumbers = ({ code, language }: { code: string, language: string }) => {
  const lines = code.split('\n');
  
  return (
    <div className="flex text-xs font-mono">
      <div className="bg-gray-800 text-gray-500 pr-4 pl-2 text-right select-none">
        {lines.map((_, i) => (
          <div key={i} className="leading-5">
            {i + 1}
          </div>
        ))}
      </div>
      <pre className="flex-1 overflow-auto pl-4 text-gray-100">
        <code className={`language-${language} whitespace-pre`}>
          {code}
        </code>
      </pre>
    </div>
  );
};

export function GamePreview({ currentVersion, showCode }: GamePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState<string>("html");

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.focus();
    }
  }, [currentVersion]);

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
    const { html, css, js } = parseCodeSections(currentVersion?.code || "");
    
    return (
      <div className="h-full relative">
        <div className="absolute inset-0 overflow-hidden flex flex-col bg-gray-900 text-white rounded-lg">
          <Tabs 
            defaultValue="html" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex items-center px-2 bg-gray-800 border-b border-gray-700">
              <TabsList className="flex gap-1 bg-transparent h-10">
                <TabsTrigger 
                  value="html" 
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-gray-700 data-[state=active]:text-white"
                >
                  <FileText size={14} />
                  <span>index.html</span>
                </TabsTrigger>
                {css && (
                  <TabsTrigger 
                    value="css" 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-gray-700 data-[state=active]:text-white"
                  >
                    <Pencil size={14} />
                    <span>styles.css</span>
                  </TabsTrigger>
                )}
                {js && (
                  <TabsTrigger 
                    value="js" 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded data-[state=active]:bg-gray-700 data-[state=active]:text-white"
                  >
                    <Code size={14} />
                    <span>script.js</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-auto">
              <TabsContent value="html" className="m-0 h-full p-0">
                <CodeWithLineNumbers code={html} language="html" />
              </TabsContent>
              
              <TabsContent value="css" className="m-0 h-full p-0">
                <CodeWithLineNumbers code={css} language="css" />
              </TabsContent>
              
              <TabsContent value="js" className="m-0 h-full p-0">
                <CodeWithLineNumbers code={js} language="javascript" />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    );
  }
}
