
import { useState, useEffect, useRef } from "react";
import { Loader2, ArrowUp, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GenerationTerminal } from "./game-creator/GenerationTerminal";

interface Message {
  id: string;
  message: string;
  response?: string | null;
  created_at: string;
  version_id?: string | null;
  image_url?: string | null;
}

interface GameChatProps {
  gameId: string;
  onGameUpdate: (newCode: string, newInstructions: string) => void;
}

export const GameChat = ({
  gameId,
  onGameUpdate
}: GameChatProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Auto-resize textarea
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
    let timer: NodeJS.Timeout;
    if (loading) {
      setThinkingTime(0);
      timer = setInterval(() => {
        setThinkingTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [loading]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !imageUrl) || loading) return;
    
    setLoading(true);
    setShowTerminal(true);
    setTerminalOutput([`> Processing request: "${message}"${imageUrl ? ' (with image)' : ''}`]);
    
    // Create temp message to show in UI
    const tempId = crypto.randomUUID();
    const tempMessage = {
      id: tempId,
      message: message.trim(),
      created_at: new Date().toISOString(),
      image_url: imageUrl
    };
    
    setMessages(prev => [...prev, tempMessage]);
    
    // Save values before clearing form
    const currentMessage = message.trim();
    const currentImageUrl = imageUrl;
    
    // Clear form
    setMessage("");
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    
    try {
      // Add the message to database
      console.log("Inserting message into database...");
      const insertData: any = {
        game_id: gameId,
        message: currentMessage
      };
      
      // Only include image_url if it exists
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
      setTerminalOutput(prev => [...prev, "> Message saved successfully"]);
      
      // Update messages list with the actual saved message
      setMessages(prev => 
        prev.map(msg => msg.id === tempId ? insertedMessage : msg)
      );
      
      // Call the edge function to process the request
      console.log("Calling process-game-update function...");
      setTerminalOutput(prev => [...prev, "> Sending request to AI..."]);
      
      // Build request payload
      const payload: any = {
        gameId: gameId,
        prompt: currentMessage
      };
      
      // Only include imageUrl if it exists
      if (currentImageUrl) {
        payload.imageUrl = currentImageUrl;
      }
      
      console.log("Request payload:", payload);
      
      const apiResponse = await fetch('https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/process-game-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo`
        },
        body: JSON.stringify(payload)
      });
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("Edge function returned an error:", errorText);
        throw new Error(`API error: ${apiResponse.status} ${apiResponse.statusText} - ${errorText}`);
      }
      
      console.log("Response received, processing stream...");
      setTerminalOutput(prev => [...prev, "> Response received, generating content..."]);
      
      // Process the streamed response
      const reader = apiResponse.body?.getReader();
      if (!reader) throw new Error("Unable to read response stream");
      
      let gameContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        console.log("Received chunk of length:", chunk.length);
        
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const parsedData = JSON.parse(line.slice(5));
            
            if (parsedData.type === 'content_block_delta' && parsedData.delta?.type === 'text_delta') {
              const content = parsedData.delta.text || '';
              if (content) {
                gameContent += content;
                const contentLines = content.split('\n');
                for (const contentLine of contentLines) {
                  if (contentLine.trim()) {
                    setTerminalOutput(prev => [...prev, `> ${contentLine}`]);
                  }
                }
              }
            }
          } catch (e) {
            console.warn("Error parsing streaming data:", e);
          }
        }
      }
      
      console.log("Stream complete, content length:", gameContent.length);
      
      if (!gameContent || !gameContent.includes('<html')) {
        console.error("Invalid content received:", gameContent.substring(0, 100));
        throw new Error("Invalid content received from AI");
      }
      
      // Update the game with the new content
      setTerminalOutput(prev => [...prev, "> Updating game..."]);
      onGameUpdate(gameContent, "Game updated successfully");
      
      // Update the message response
      const { error: updateError } = await supabase
        .from('game_messages')
        .update({ response: "Game updated successfully" })
        .eq('id', insertedMessage.id);
      
      if (updateError) {
        console.error("Error updating message response:", updateError);
      }
      
      // Refresh the messages list
      const { data: updatedMessages } = await supabase
        .from('game_messages')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });
        
      if (updatedMessages) {
        setMessages(updatedMessages);
      }
      
      setTerminalOutput(prev => [...prev, "> Game updated successfully!"]);
      
      setTimeout(() => {
        setShowTerminal(false);
      }, 2000);
      
      toast({
        title: "Game updated successfully",
        description: "The changes have been applied to your game."
      });
      
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      
      setTerminalOutput(prev => [...prev, 
        `> Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      ]);
      
      toast({
        title: "Error processing message",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
      
      // Remove the temporary message since it failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
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
                <p className="text-blue-800">{msg.message}</p>
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

      <form onSubmit={handleSubmit} className="p-4 border-t relative">
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
              >
                <X size={16} className="text-gray-600" />
              </button>
            </div>
          </div>
        )}
        
        <div className="bg-[#2A2A2A] rounded-2xl shadow-md p-4">
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
              placeholder="Request a change" 
              className="w-full bg-transparent text-white border-none focus:ring-0 focus:outline-none resize-none min-h-[24px] max-h-[200px] py-0 px-0" 
              disabled={loading}
              rows={1}
            />
          </div>
          
          <div className="flex items-center justify-between mt-6 gap-2">
            <div className="flex items-center gap-4">
              <label
                className="flex items-center gap-2 text-white/80 cursor-pointer hover:text-white transition-colors"
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
                  disabled={loading || isUploading}
                />
              </label>
            </div>
            
            <button 
              type="submit" 
              disabled={loading || (!message.trim() && !imageUrl) || isUploading} 
              className="h-10 w-10 rounded-full bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
              aria-label="Send message"
            >
              {loading ? 
                <Loader2 className="animate-spin" size={18} /> : 
                <ArrowUp size={18} />
              }
            </button>
          </div>
          
          {isUploading && (
            <div className="mt-2 text-xs text-gray-400 animate-pulse">
              Uploading image...
            </div>
          )}
        </div>
      </form>

      <GenerationTerminal open={showTerminal} onOpenChange={setShowTerminal} output={terminalOutput} thinkingTime={thinkingTime} loading={loading} />
    </div>;
};
