
import { useState, useEffect } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GenerationTerminal } from "./game-creator/GenerationTerminal";

interface Message {
  id: string;
  message: string;
  response?: string | null;
  created_at: string;
  version_id?: string | null;
}

interface GameChatProps {
  gameId: string;
  onGameUpdate: (newCode: string, newInstructions: string) => void;
}

export const GameChat = ({ gameId, onGameUpdate }: GameChatProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [thinkingTime, setThinkingTime] = useState(0);
  const { toast } = useToast();

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
          variant: "destructive",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    setLoading(true);
    setShowTerminal(true);
    setTerminalOutput([`> Processing request: "${message}"`]);

    try {
      // First, save the message
      const { data: messageData, error: messageError } = await supabase
        .from('game_messages')
        .insert([
          {
            game_id: gameId,
            message: message.trim(),
          }
        ])
        .select()
        .single();

      if (messageError) throw messageError;

      // Add message to local state
      setMessages(prev => [...prev, messageData]);
      setMessage("");

      // Call process-game-update function with streaming
      const response = await fetch(
        'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/process-game-update',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo',
          },
          body: JSON.stringify({ 
            gameId, 
            message: message.trim() 
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      let gameContent = '';

      while (true) {
        const { done, value } = await reader.read();
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
                setTerminalOutput(prev => [...prev, `> Generated ${content.length} characters of game code`]);
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

      // Update the game in parent component
      onGameUpdate(gameContent, "Game updated successfully");
      
      // Update message with response
      const { error: updateError } = await supabase
        .from('game_messages')
        .update({
          response: "Game updated successfully",
        })
        .eq('id', messageData.id);

      if (updateError) throw updateError;

      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageData.id 
          ? { ...msg, response: "Game updated successfully" }
          : msg
      ));

      setTerminalOutput(prev => [...prev, "> Game updated successfully!"]);
      
      // Close terminal after a delay
      setTimeout(() => {
        setShowTerminal(false);
      }, 2000);

      toast({
        title: "Game updated successfully",
        description: "The changes have been applied to your game.",
      });
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setTerminalOutput(prev => [...prev, `> Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      
      toast({
        title: "Error processing message",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      
      // Clean up the message if there was an error
      if (messages[messages.length - 1]?.response === undefined) {
        const { error: deleteError } = await supabase
          .from('game_messages')
          .delete()
          .eq('id', messages[messages.length - 1].id);
          
        if (!deleteError) {
          setMessages(prev => prev.slice(0, -1));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingHistory ? (
          <div className="flex justify-center">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-500">
            No messages yet. Ask me to modify the game!
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-blue-800">{msg.message}</p>
              </div>
              {msg.response && (
                <div className="bg-gray-50 p-3 rounded-lg ml-4">
                  <p className="text-gray-800">{msg.response}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Ask me to modify the game..."
            className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <MessageSquare size={20} />
            )}
            <span>Send</span>
          </button>
        </div>
      </form>

      <GenerationTerminal
        open={showTerminal}
        onOpenChange={setShowTerminal}
        output={terminalOutput}
        thinkingTime={thinkingTime}
        loading={loading}
      />
    </div>
  );
};
