
import { useState, useEffect, useRef } from "react";
import { Loader2, ArrowUp, Image as ImageIcon, X } from "lucide-react";
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
  const {
    toast
  } = useToast();

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
        const {
          data,
          error
        } = await supabase.from('game_messages').select('*').eq('game_id', gameId).order('created_at', {
          ascending: true
        });
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
    
    try {
      const {
        data: messageData,
        error: messageError
      } = await supabase.from('game_messages').insert([{
        game_id: gameId,
        message: message.trim(),
        image_url: imageUrl
      }]).select().single();
      
      if (messageError) throw messageError;
      setMessages(prev => [...prev, messageData]);
      setMessage("");
      setImageUrl(null);
      
      const response = await fetch('https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/process-game-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo'
        },
        body: JSON.stringify({
          gameId,
          message: message.trim(),
          imageUrl: imageUrl
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      
      let gameContent = '';
      while (true) {
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(5));
            if (data.type === 'content_block_start') {
              setTerminalOutput(prev => [...prev, '> Starting game code generation...']);
            } else if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              const content = data.delta.text || '';
              if (content) {
                gameContent += content;
                const lines = content.split('\n');
                for (const line of lines) {
                  if (line.trim()) {
                    setTerminalOutput(prev => [...prev, `> ${line}`]);
                  }
                }
              }
            } else if (data.type === 'content_block_stop') {
              setTerminalOutput(prev => [...prev, '> Finished generating game code']);
            }
          } catch (e) {
            console.error('Error parsing line:', e);
          }
        }
      }
      
      if (!gameContent || !gameContent.includes('<html')) {
        throw new Error('Invalid game content received');
      }
      
      setTerminalOutput(prev => [...prev, "> Saving new game version..."]);
      onGameUpdate(gameContent, "Game updated successfully");
      
      const {
        error: updateError
      } = await supabase.from('game_messages').update({
        response: "Game updated successfully"
      }).eq('id', messageData.id);
      
      if (updateError) throw updateError;
      
      setMessages(prev => prev.map(msg => msg.id === messageData.id ? {
        ...msg,
        response: "Game updated successfully"
      } : msg));
      
      setTerminalOutput(prev => [...prev, "> Game updated successfully!"]);
      setTimeout(() => {
        setShowTerminal(false);
      }, 2000);
      
      toast({
        title: "Game updated successfully",
        description: "The changes have been applied to your game."
      });
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      
      toast({
        title: "Error processing message",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
      
      if (messages[messages.length - 1]?.response === undefined) {
        const {
          error: deleteError
        } = await supabase.from('game_messages').delete().eq('id', messages[messages.length - 1].id);
        if (!deleteError) {
          setMessages(prev => prev.slice(0, -1));
        }
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
        
        <div className="flex space-x-2 items-end">
          <div className="flex-1 relative">
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
              placeholder="Ask me to modify the game..." 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[44px] max-h-[200px] resize-none pr-12" 
              disabled={loading}
              rows={1}
            />
            
            <button 
              type="submit" 
              disabled={loading || (!message.trim() && !imageUrl) || isUploading} 
              className="absolute right-2 bottom-2 rounded-full bg-blue-500 p-2 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-8 w-8"
              aria-label="Send message"
            >
              {loading ? 
                <Loader2 className="animate-spin" size={16} /> : 
                <ArrowUp size={16} />
              }
            </button>
          </div>
          
          <label
            className={`p-2 border rounded-lg cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'} transition-colors`}
            title="Upload image"
          >
            <ImageIcon size={20} className="text-gray-600" />
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
        
        {isUploading && (
          <div className="mt-1 text-xs text-gray-500 animate-pulse">
            Uploading image...
          </div>
        )}
      </form>

      <GenerationTerminal open={showTerminal} onOpenChange={setShowTerminal} output={terminalOutput} thinkingTime={thinkingTime} loading={loading} />
    </div>;
};
