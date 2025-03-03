
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function NetlifyCallback() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const state = params.get("state");

        if (!code || !state) {
          throw new Error("Missing required parameters");
        }

        // Exchange the code for a token
        const { data, error } = await supabase.functions.invoke("netlify-integration", {
          body: { path: "exchange-code", code, state }
        });

        if (error) {
          throw error;
        }

        toast({
          title: "Successfully connected to Netlify",
          description: "You can now deploy your games to Netlify"
        });

        // Retrieve the game ID from localStorage
        const gameId = localStorage.getItem("netlify_deploy_game_id");
        
        // Navigate back to the game page
        if (gameId) {
          localStorage.removeItem("netlify_deploy_game_id");
          navigate(`/play/${gameId}`);
        } else {
          navigate("/");
        }
      } catch (err) {
        console.error("Netlify callback error:", err);
        setError(err instanceof Error ? err.message : "Failed to authenticate with Netlify");
        toast({
          title: "Authentication Failed",
          description: "Could not connect to Netlify. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [location, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Netlify Authentication</h1>
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Connecting to Netlify...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p><strong>Error:</strong> {error}</p>
            <button 
              onClick={() => navigate("/")}
              className="mt-4 bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded"
            >
              Return Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
