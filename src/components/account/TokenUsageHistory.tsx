
import { useEffect, useState } from "react";
import { fetchTokenUsageHistory } from "@/components/game-chat/api-service";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Zap, ArrowDownUp } from "lucide-react";

interface TokenUsageEntry {
  id: string;
  game_id: string;
  message_id: string;
  input_tokens: number;
  output_tokens: number;
  model_type: string;
  created_at: string;
  games: {
    prompt: string;
  } | null;
}

export const TokenUsageHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tokenHistory, setTokenHistory] = useState<TokenUsageEntry[]>([]);
  const [totalTokens, setTotalTokens] = useState({ 
    smart: { input: 0, output: 0 }, 
    fast: { input: 0, output: 0 }, 
    total: { input: 0, output: 0 } 
  });

  useEffect(() => {
    const loadTokenUsage = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const { data, error } = await fetchTokenUsageHistory(user.id);
        
        if (error) throw error;
        
        if (data) {
          setTokenHistory(data as TokenUsageEntry[]);
          
          // Calculate totals
          const totals = data.reduce(
            (acc, entry) => {
              const inputTokens = entry.input_tokens || 0;
              const outputTokens = entry.output_tokens || 0;
              
              // Add to total
              acc.total.input += inputTokens;
              acc.total.output += outputTokens;
              
              // Add to model-specific
              if (entry.model_type === "smart") {
                acc.smart.input += inputTokens;
                acc.smart.output += outputTokens;
              } else if (entry.model_type === "fast") {
                acc.fast.input += inputTokens;
                acc.fast.output += outputTokens;
              }
              
              return acc;
            },
            { 
              smart: { input: 0, output: 0 }, 
              fast: { input: 0, output: 0 }, 
              total: { input: 0, output: 0 } 
            }
          );
          
          setTotalTokens(totals);
        }
      } catch (error) {
        console.error("Error loading token usage history:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTokenUsage();
  }, [user]);
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Usage History</CardTitle>
          <CardDescription>Loading your usage data...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database size={18} />
          Token Usage History
        </CardTitle>
        <CardDescription>
          Track your AI model usage over time
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {tokenHistory.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            No token usage data available yet. Start creating content to see your usage!
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-md p-3 text-center">
                <p className="text-gray-500 text-sm">Total</p>
                <p className="text-2xl font-bold">{(totalTokens.total.input + totalTokens.total.output).toLocaleString()}</p>
                <div className="flex justify-center text-xs text-gray-400 mt-1 gap-2">
                  <span>{totalTokens.total.input.toLocaleString()} in</span>
                  <ArrowDownUp size={12} />
                  <span>{totalTokens.total.output.toLocaleString()} out</span>
                </div>
              </div>
              <div className="bg-purple-50 rounded-md p-3 text-center">
                <p className="text-purple-500 text-sm">Anthropic</p>
                <p className="text-2xl font-bold text-purple-600">{(totalTokens.smart.input + totalTokens.smart.output).toLocaleString()}</p>
                <div className="flex justify-center text-xs text-gray-400 mt-1 gap-2">
                  <span>{totalTokens.smart.input.toLocaleString()} in</span>
                  <ArrowDownUp size={12} />
                  <span>{totalTokens.smart.output.toLocaleString()} out</span>
                </div>
              </div>
              <div className="bg-green-50 rounded-md p-3 text-center">
                <p className="text-green-500 text-sm">Groq</p>
                <p className="text-2xl font-bold text-green-600">{(totalTokens.fast.input + totalTokens.fast.output).toLocaleString()}</p>
                <div className="flex justify-center text-xs text-gray-400 mt-1 gap-2">
                  <span>{totalTokens.fast.input.toLocaleString()} in</span>
                  <ArrowDownUp size={12} />
                  <span>{totalTokens.fast.output.toLocaleString()} out</span>
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="text-sm font-medium mb-2">Recent Activity</div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {tokenHistory.map((entry) => (
                <div key={entry.id} className="border rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <Zap size={14} className="text-amber-500" />
                      <span className="font-medium">
                        {(entry.input_tokens + entry.output_tokens).toLocaleString()} tokens
                      </span>
                      <span className="text-xs text-gray-500">
                        ({entry.input_tokens.toLocaleString()} in / {entry.output_tokens.toLocaleString()} out)
                      </span>
                    </div>
                    <Badge variant={entry.model_type === "smart" ? "purple" : "success"}>
                      {entry.model_type === "smart" ? "Anthropic" : "Groq"}
                    </Badge>
                  </div>
                  
                  <p className="text-gray-500 truncate mb-1" title={entry.games?.prompt || "Unknown prompt"}>
                    {entry.games?.prompt ? `"${entry.games.prompt.substring(0, 60)}${entry.games.prompt.length > 60 ? '...' : ''}"` : "Unknown prompt"}
                  </p>
                  
                  <p className="text-xs text-gray-400">
                    {formatDate(entry.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
