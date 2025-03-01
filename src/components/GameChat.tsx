import { useState, useEffect, useRef } from "react";
import { Loader2, ArrowUp, Paperclip, X, Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  message: string;
  response?: string | null;
  created_at: string;
  version_id?: string | null;
  image_url?: string | null;
  model_type?: string | null;
}

interface GameChatProps {
  gameId: string;
  onGameUpdate: (newCode: string, newInstructions: string) => void;
  onTerminalStatusChange?: (showing: boolean, output: string[], thinking: number, isLoading: boolean) => void;
  disabled?: boolean;
}

export const GameChat = ({
  gameId,
  onGameUpdate,
  onTerminalStatusChange,
  disabled = false
}: GameChatProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [modelType, setModelType] = useState<string>("smart");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('game_messages')
          .select('*')
          .eq('game_id', gameId)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        toast({
          title: "Error loading chat history",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive"
        });
      } finally {
        setLoadingHistory(false);
      }
    };
    
    fetchMessages();
  }, [gameId, toast]);

  useEffect(() => {
    if (loading) {
      setThinkingTime(0);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      timerRef.current = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading]);

  useEffect(() => {
    if (onTerminalStatusChange && loading) {
      onTerminalStatusChange(true, terminalOutput, thinkingTime, loading);
    }
  }, [thinkingTime, terminalOutput, loading, onTerminalStatusChange]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageUrl(reader.result);
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your image",
        variant: "destructive"
      });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const updateTerminalOutput = (newContent: string, isNewMessage = false) => {
    setTerminalOutput(prev => {
      if (isNewMessage || 
          newContent.startsWith("> Thinking:") || 
          newContent.startsWith("> Generation") || 
          newContent.includes("completed") || 
          newContent.includes("Error:")) {
        return [...prev, newContent];
      }
      
      if (prev.length > 0) {
        const lastLine = prev[prev.length - 1];
        
        if (lastLine.startsWith("> ") && !lastLine.startsWith("> Thinking:") && 
            newContent.startsWith("> ") && !newContent.startsWith("> Thinking:")) {
          
          const updatedLastLine = lastLine + newContent.slice(1);
          return [...prev.slice(0, -1), updatedLastLine];
        }
      }
      
      return [...prev, newContent];
    });
  };

  const toggleModelType = () => {
    setModelType(prev => prev === "smart" ? "fast" : "smart");
    toast({
      title: `Switched to ${modelType === "smart" ? "Fastest" : "Smartest"} model`,
      description: modelType === "smart" 
        ? "Using Groq's Mixtral 8x7B for faster responses" 
        : "Using Claude for higher quality responses"
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !imageUrl) || loading || disabled) return;
    
    setLoading(true);
    setThinkingTime(0);
    
    const initialMessage = `> Processing request: "${message}"${imageUrl ? ' (with image)' : ''}`;
    setTerminalOutput([initialMessage]);
    
    updateTerminalOutput(`> Using ${modelType === "smart" ? "Anthropic (Smartest)" : "Groq (Fastest)"} model`, true);
    
    if (onTerminalStatusChange) {
      onTerminalStatusChange(true, [initialMessage], 0, true);
    }
    
    const tempId = crypto.randomUUID();
    const tempMessage = {
      id: tempId,
      message: message.trim(),
      created_at: new Date().toISOString(),
      image_url: imageUrl,
      model_type: modelType
    };
    
    setMessages(prev => [...prev, tempMessage]);
    
    const currentMessage = message.trim();
    const currentImageUrl = imageUrl;
    const currentModelType = modelType;
    
    setMessage("");
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    
    try {
      console.log("Inserting message into database...");
      const insertData: any = {
        game_id: gameId,
        message: currentMessage,
        model_type: currentModelType
      };
      
      if (currentImageUrl) {
        insertData.image_url = currentImageUrl;
      }
      
      const { data: insertedMessage, error: messageError } = await supabase
        .from('game_messages')
        .insert(insertData)
        .select()
        .single();
      
      if (messageError) {
        console.error("Failed to save message:", messageError);
        throw new Error(`Database error: ${messageError.message}`);
      }
      
      if (!insertedMessage) {
        throw new Error("No data returned from message insert");
      }
      
      console.log("Message inserted successfully:", insertedMessage);
      updateTerminalOutput("> Message saved successfully", true);
      
      setMessages(prev => 
        prev.map(msg => msg.id === tempId ? insertedMessage : msg)
      );
      
      console.log("Calling process-game-update function...");
      updateTerminalOutput("> Sending request to AI...", true);
      
      const payload: {
        gameId: string;
        message: string;
        modelType: string;
        imageUrl?: string;
        stream?: boolean;
      } = {
        gameId: gameId,
        message: currentMessage,
        modelType: currentModelType,
        stream: true // Enable streaming for both models
      };
      
      if (currentImageUrl) {
        payload.imageUrl = currentImageUrl;
      }
      
      console.log("Request payload:", payload);
      
      const apiUrl = currentModelType === "fast" 
        ? 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/process-game-update-with-groq'
        : 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/process-game-update';
      
      updateTerminalOutput(`> Connecting to ${currentModelType === "fast" ? "Groq" : "Anthropic"} API...`, true);
      
      try {
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`
          },
          body: JSON.stringify(payload)
        });
        
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          console.error("API response error:", apiResponse.status, errorText);
          throw new Error(`API error (${apiResponse.status}): ${errorText.substring(0, 200)}`);
        }
        
        console.log("API connection established, processing response...");
        updateTerminalOutput("> Connection established, receiving content...", true);
        
        const reader = apiResponse.body?.getReader();
        if (!reader) throw new Error("Unable to read response stream");
        
        let content = '';
        let combinedResponse = '';
        let totalChunks = 0;
        let buffer = '';
        let currentLineContent = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log("Stream complete after", totalChunks, "chunks");
            break;
          }
          
          totalChunks++;
          const chunk = new TextDecoder().decode(value);
          buffer += chunk;
          
          console.log(`Received chunk #${totalChunks}, size: ${chunk.length}`);
          if (chunk.length > 0 && totalChunks < 3) {
            console.log("Chunk sample:", chunk.substring(0, 200));
          }
          
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, lineEnd);
            buffer = buffer.slice(lineEnd + 1);
            
            if (!line) continue;
            
            if (line.startsWith('data: ')) {
              try {
                const parsedData = JSON.parse(line.slice(5));
                
                if (parsedData.type === 'content_block_delta' && parsedData.delta?.type === 'text_delta') {
                  const contentChunk = parsedData.delta.text || '';
                  if (contentChunk) {
                    content += contentChunk;
                    combinedResponse += contentChunk;
                    
                    if (contentChunk.includes('\n')) {
                      const lines = contentChunk.split('\n');
                      
                      if (lines[0]) {
                        currentLineContent += lines[0];
                        updateTerminalOutput(`> ${currentLineContent}`, false);
                      }
                      
                      for (let i = 1; i < lines.length - 1; i++) {
                        if (lines[i].trim()) {
                          currentLineContent = lines[i];
                          updateTerminalOutput(`> ${currentLineContent}`, true);
                        }
                      }
                      
                      if (lines.length > 1) {
                        currentLineContent = lines[lines.length - 1];
                        if (currentLineContent) {
                          updateTerminalOutput(`> ${currentLineContent}`, true);
                        } else {
                          currentLineContent = '';
                        }
                      }
                    } else {
                      currentLineContent += contentChunk;
                      updateTerminalOutput(`> ${currentLineContent}`, false);
                    }
                  }
                } else if (parsedData.type === 'thinking') {
                  const thinking = parsedData.thinking || '';
                  if (thinking && thinking.trim()) {
                    updateTerminalOutput(`> Thinking: ${thinking}`, true);
                  }
                } else if (parsedData.type === 'message_stop') {
                  updateTerminalOutput("> Content generation completed!", true);
                }
              } catch (e) {
                console.warn("Error parsing Anthropic data:", e);
              }
            } else {
              try {
                const parsedData = JSON.parse(line);
                console.log("Parsed Groq data:", parsedData);
                
                if (parsedData.choices && parsedData.choices[0]?.delta?.content) {
                  const contentChunk = parsedData.choices[0].delta.content;
                  if (contentChunk) {
                    content += contentChunk;
                    combinedResponse += contentChunk;
                    console.log("Added Groq content chunk, length:", contentChunk.length);
                    
                    if (contentChunk.includes('\n')) {
                      const lines = contentChunk.split('\n');
                      
                      if (lines[0]) {
                        currentLineContent += lines[0];
                        updateTerminalOutput(`> ${currentLineContent}`, false);
                      }
                      
                      for (let i = 1; i < lines.length - 1; i++) {
                        if (lines[i].trim()) {
                          currentLineContent = lines[i];
                          updateTerminalOutput(`> ${currentLineContent}`, true);
                        }
                      }
                      
                      if (lines.length > 1) {
                        currentLineContent = lines[lines.length - 1];
                        if (currentLineContent) {
                          updateTerminalOutput(`> ${currentLineContent}`, true);
                        } else {
                          currentLineContent = '';
                        }
                      }
                    } else {
                      currentLineContent += contentChunk;
                      updateTerminalOutput(`> ${currentLineContent}`, false);
                    }
                  }
                } else if (parsedData.choices && parsedData.choices[0]?.finish_reason) {
                  updateTerminalOutput(`> Generation ${parsedData.choices[0].finish_reason}`, true);
                }
              } catch (e) {
                console.log("Failed to parse as JSON, might be partial chunk:", e);
              }
            }
          }
        }
        
        console.log("Content collection complete. Total length:", content.length);
        
        if (!content || content.trim().length === 0) {
          throw new Error("No content received from AI. Please try again.");
        }
        
        updateTerminalOutput("> Processing received content...", true);
        
        if (currentModelType === "fast") {
          console.log("Processing Groq content");
          
          if (content.includes("```html")) {
            console.log("Found HTML code block, extracting...");
            const htmlMatch = content.match(/```html\s*([\s\S]*?)```/);
            if (htmlMatch && htmlMatch[1] && htmlMatch[1].trim().length > 0) {
              content = htmlMatch[1].trim();
              console.log("Extracted HTML from code block, length:", content.length);
              updateTerminalOutput("> Extracted HTML from code block", true);
            }
          }
          
          const isFullHtmlDocument = 
            content.includes('<!DOCTYPE html>') || 
            (content.includes('<html') && content.includes('</html>'));
          
          const hasHtmlElements = 
            !isFullHtmlDocument && 
            content.includes('<') && content.includes('>') &&
            (content.includes('<div') || content.includes('<p') || content.includes('<span'));
          
          if (!isFullHtmlDocument) {
            if (hasHtmlElements) {
              console.log("Content contains HTML elements but not full document, wrapping...");
              updateTerminalOutput("> Content contains HTML elements, wrapping in full document...", true);
              
              content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    pre {
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
    }
    code {
      font-family: monospace;
      background-color: #f5f5f5;
      padding: 2px 4px;
      border-radius: 3px;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    a {
      color: #3498db;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="content">
    ${content}
  </div>
</body>
</html>`;
            } else {
              console.log("Content appears to be plain text, converting to HTML...");
              updateTerminalOutput("> Converting plain text to HTML...", true);
              
              content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    pre {
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
    }
    code {
      font-family: monospace;
      background-color: #f5f5f5;
      padding: 2px 4px;
      border-radius: 3px;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    a {
      color: #3498db;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="content">
    ${content
      .split('\n')
      .map(line => {
        if (line.trim().length === 0) return '';
        if (line.startsWith('#')) {
          const level = line.match(/^#+/)[0].length;
          const text = line.replace(/^#+\s*/, '');
          return `<h${level}>${text}</h${level}>`;
        }
        return `<p>${line}</p>`;
      })
      .join('\n')}
  </div>
</body>
</html>`;
            }
          }
        }
        
        console.log("Final content length:", content.length);
        
        if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
          console.error("Invalid content structure:", content.substring(0, 200));
          throw new Error("Invalid content structure received from AI. Please try again or switch models.");
        }
        
        updateTerminalOutput("> Updating content in the application...", true);
        
        onGameUpdate(content, "Content updated successfully");
        
        const { error: updateError } = await supabase
          .from('game_messages')
          .update({ response: "Content updated successfully" })
          .eq('id', insertedMessage.id);
        
        if (updateError) {
          console.error("Error updating message response:", updateError);
        }
        
        const { data: updatedMessages } = await supabase
          .from('game_messages')
          .select('*')
          .eq('game_id', gameId)
          .order('created_at', { ascending: true });
          
        if (updatedMessages) {
          setMessages(updatedMessages);
        }
        
        updateTerminalOutput("> Content updated successfully!", true);
        
        if (onTerminalStatusChange) {
          setTimeout(() => {
            onTerminalStatusChange(false, [], 0, false);
          }, 3000);
        }
        
        toast({
          title: "Content updated successfully",
          description: "The changes have been applied successfully."
        });
        
      } catch (fetchError) {
        console.error("Fetch error:", fetchError);
        throw new Error(`Failed to connect to AI service: ${fetchError.message}`);
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      
      updateTerminalOutput(
        `> Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true
      );
      
      toast({
        title: "Error processing message",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
      
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      if (onTerminalStatusChange) {
        setTimeout(() => {
          onTerminalStatusChange(false, [], 0, false);
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  return <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingHistory ? <div className="flex justify-center">
            <Loader2 className="animate-spin" size={24} />
          </div> : messages.length === 0 ? <p className="text-center text-gray-500">No messages yet. Ask me to modify!</p> : messages.map(msg => <div key={msg.id} className="space-y-2">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between items-start">
                  <p className="text-blue-800">{msg.message}</p>
                  {msg.model_type && (
                    <span className="text-xs text-blue-500 flex items-center ml-2 px-2 py-0.5 rounded-full bg-blue-100">
                      <Cpu size={12} className="mr-1" />
                      {msg.model_type === "smart" ? "Smart" : "Fast"}
                    </span>
                  )}
                </div>
                {msg.image_url && (
                  <div className="mt-2 max-w-xs">
                    <img 
                      src={msg.image_url} 
                      alt="User uploaded image" 
                      className="rounded-md max-h-48 object-contain"
                    />
                  </div>
                )}
              </div>
              {msg.response && <div className="bg-gray-50 p-3 rounded-lg ml-4">
                  <p className="text-gray-800">{msg.response}</p>
                </div>}
            </div>)}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t relative flex-shrink-0">
        {imageUrl && (
          <div className="mb-3 relative">
            <div className="relative rounded-lg overflow-hidden border border-gray-200 inline-flex max-w-xs">
              <img 
                src={imageUrl} 
                alt="Selected image" 
                className="max-h-48 object-contain"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 p-1 bg-white/90 rounded-full hover:bg-white transition-colors shadow-sm"
                disabled={disabled}
              >
                <X size={16} className="text-gray-600" />
              </button>
            </div>
          </div>
        )}
        
        <div className={`bg-[#F1F1F1] rounded-2xl shadow-sm p-4 border border-gray-100 ${disabled ? 'opacity-50' : ''}`}>
          <div className="relative">
            <textarea 
              ref={textareaRef}
              value={message} 
              onChange={e => setMessage(e.target.value)} 
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }} 
              placeholder={disabled ? "Chat will be enabled once generation is complete..." : "Request a change"} 
              className="w-full bg-transparent text-gray-800 border-none focus:ring-0 focus:outline-none resize-none min-h-[24px] max-h-[200px] py-0 px-0 placeholder-gray-500" 
              disabled={loading || disabled}
              rows={1}
            />
          </div>
          
          <div className="flex items-center justify-between mt-6 gap-2">
            <div className="flex items-center gap-4">
              <label
                className={`flex items-center gap-2 text-gray-600 cursor-pointer hover:text-gray-800 transition-colors ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                title="Attach"
              >
                <Paperclip size={20} />
                <span className="text-sm font-medium">Attach</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={loading || isUploading || disabled}
                />
              </label>
              
              <button
                type="button"
                onClick={toggleModelType}
                className={`flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                disabled={loading || disabled}
                title={`Using ${modelType === "smart" ? "Smartest" : "Fastest"} model. Click to toggle.`}
              >
                <Cpu size={20} />
                <span className="text-sm font-medium">{modelType === "smart" ? "Smartest" : "Fastest"}</span>
              </button>
            </div>
            
            <button 
              type="submit" 
              disabled={loading || (!message.trim() && !imageUrl) || isUploading || disabled} 
              className="h-10 w-10 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
              aria-label="Send message"
            >
              {loading ? 
                <Loader2 className="animate-spin" size={18} /> : 
                <ArrowUp size={18} />
              }
            </button>
          </div>
          
          {isUploading && (
            <div className="mt-2 text-xs text-gray-500 animate-pulse">
              Uploading image...
            </div>
          )}
          
          {disabled && (
            <div className="mt-2 text-xs text-gray-500">
              Chat will be enabled after content generation is complete
            </div>
          )}
        </div>
      </form>
    </div>;
};
