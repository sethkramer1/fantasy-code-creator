import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get('gameId');

    if (!gameId) {
      return new Response(JSON.stringify({ error: 'Missing gameId parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create a response with a readable stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initialMessage = `data: ${JSON.stringify({ type: 'connection', message: 'Connected to stream' })}\n\n`;
        controller.enqueue(new TextEncoder().encode(initialMessage));

        // Set up Supabase client
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check if the game exists and if it's still generating
        const checkGameStatus = async () => {
          try {
            const { data, error } = await supabase
              .from('games')
              .select('prompt, code, type')
              .eq('id', gameId)
              .single();

            if (error) throw error;
            if (!data) throw new Error('Game not found');

            if (data.code !== 'Generating...') {
              // Game has already been generated, send completed message
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'completed', message: 'Generation already completed' })}\n\n`
              ));
              
              // Close the stream
              controller.close();
              return false;
            }

            // Send game details
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: 'details', 
                prompt: data.prompt, 
                contentType: data.type 
              })}\n\n`
            ));

            // Simulate thinking messages to keep the connection alive while generation happens
            let thinkingCount = 0;
            const thinkingMessages = [
              "Analyzing your requirements...",
              "Planning the structure...",
              "Writing HTML skeleton...",
              "Adding styling with CSS...",
              "Implementing functionality...",
              "Testing responsiveness...",
              "Adding final touches...",
              "Optimizing code..."
            ];

            const interval = setInterval(() => {
              // Send thinking messages every few seconds
              if (thinkingCount < thinkingMessages.length) {
                controller.enqueue(new TextEncoder().encode(
                  `data: ${JSON.stringify({ 
                    type: 'thinking', 
                    thinking: thinkingMessages[thinkingCount] 
                  })}\n\n`
                ));
                thinkingCount++;
              } else {
                // After going through all thinking messages, send a generic one to keep connection alive
                controller.enqueue(new TextEncoder().encode(
                  `data: ${JSON.stringify({ 
                    type: 'thinking', 
                    thinking: "Generation in progress..." 
                  })}\n\n`
                ));
              }
            }, 3000);

            // Check every 5 seconds if the game has been updated
            const statusInterval = setInterval(async () => {
              try {
                const { data: refreshedData, error: refreshError } = await supabase
                  .from('games')
                  .select('code')
                  .eq('id', gameId)
                  .single();

                if (refreshError) throw refreshError;
                
                // If generation is complete, notify and close
                if (refreshedData && refreshedData.code !== 'Generating...') {
                  clearInterval(interval);
                  clearInterval(statusInterval);
                  
                  controller.enqueue(new TextEncoder().encode(
                    `data: ${JSON.stringify({ 
                      type: 'completed', 
                      message: 'Generation completed successfully' 
                    })}\n\n`
                  ));
                  
                  // Close the stream
                  setTimeout(() => controller.close(), 1000);
                }
              } catch (err) {
                console.error("Error polling game status:", err);
              }
            }, 5000);

            // Set a timeout to close the stream after 5 minutes at most
            setTimeout(() => {
              clearInterval(interval);
              clearInterval(statusInterval);
              
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({ 
                  type: 'timeout', 
                  message: 'Stream timed out after 5 minutes' 
                })}\n\n`
              ));
              
              controller.close();
            }, 5 * 60 * 1000);

            return true;
          } catch (error) {
            console.error('Error checking game status:', error);
            
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: 'error', 
                error: error instanceof Error ? error.message : 'Unknown error' 
              })}\n\n`
            ));
            
            controller.close();
            return false;
          }
        };

        checkGameStatus();
      }
    });

    return new Response(stream, { headers: corsHeaders });

  } catch (error) {
    console.error('Error in stream-generation function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
