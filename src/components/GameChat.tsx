
import { useState, useEffect } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();

  // Changed from useState to useEffect for initialization
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    setLoading(true);
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

      // Call Edge Function to process the message
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'process-game-update',
        {
          body: { gameId, message: message.trim() }
        }
      );

      if (functionError) throw functionError;

      if (functionData.code && functionData.instructions) {
        // Update the game in parent component
        onGameUpdate(functionData.code, functionData.instructions);
        
        // Update message with response
        const { error: updateError } = await supabase
          .from('game_messages')
          .update({
            response: functionData.response,
            version_id: functionData.versionId
          })
          .eq('id', messageData.id);

        if (updateError) throw updateError;

        // Update local state
        setMessages(prev => prev.map(msg => 
          msg.id === messageData.id 
            ? { ...msg, response: functionData.response, version_id: functionData.versionId }
            : msg
        ));
      }
    } catch (error) {
      toast({
        title: "Error processing message",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
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
            onKeyDown={(e) => e.stopPropagation()} // Add this to prevent space key event propagation
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
    </div>
  );
};
