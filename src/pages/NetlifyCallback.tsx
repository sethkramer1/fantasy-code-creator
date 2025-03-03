
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const NetlifyCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    async function processCallback() {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (!code || !state) {
          setError("Missing required parameters");
          setProcessing(false);
          return;
        }
        
        // Complete the OAuth flow
        const { data, error } = await supabase.functions.invoke('netlify-integration', {
          method: 'GET',
          query: { 
            path: 'callback',
            code,
            state
          }
        });
        
        if (error) {
          throw error;
        }
        
        // Get the game ID from the response or localStorage
        const gameId = data.gameId || localStorage.getItem('netlify_deploy_game_id');
        
        // Clean up localStorage
        localStorage.removeItem('netlify_deploy_game_id');
        
        // Redirect back to the game
        if (gameId) {
          navigate(`/play/${gameId}`);
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error("Error processing callback:", error);
        setError("Failed to complete authorization");
        setProcessing(false);
      }
    }
    
    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          {error ? "Authorization Failed" : "Completing Authorization"}
        </h1>
        
        {processing && !error && (
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4"></div>
            <p>Connecting to Netlify...</p>
          </div>
        )}
        
        {error && (
          <div className="text-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
            >
              Return Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetlifyCallback;
