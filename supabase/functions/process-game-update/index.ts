
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { gameId, message } = await req.json()
    console.log('Received request:', { gameId, message })
    
    if (!gameId || !message) {
      throw new Error('Game ID and message are required')
    }

    // Get current game version
    const { data: gameData, error: gameError } = await supabaseAdmin
      .from('games')
      .select(`
        current_version,
        game_versions!inner (
          code,
          instructions
        )
      `)
      .eq('id', gameId)
      .single()

    if (gameError) throw gameError;
    if (!gameData) throw new Error('Game not found');

    const currentVersion = gameData.current_version;
    const currentCode = gameData.game_versions[0].code;

    console.log('Current game version:', currentVersion)

    // Stream the response from Claude
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 20000,
        temperature: 0,
        system: "You are an AI that modifies HTML games based on user requests. You should respond ONLY with the complete HTML code for the game, nothing else. No explanations, no comments, just the game code.",
        messages: [
          {
            role: "user",
            content: `Here is the current HTML game code:\n\n${currentCode}\n\nPlease modify the game according to this request: ${message}\n\n
                     When modifying the game, ensure:
                     - All existing functionality remains working (Start button, controls, game over handling, etc.)
                     - Game initializes and starts correctly when the user clicks play/start
                     - The changes integrate smoothly with the current game mechanics
                     - Any new features have proper user feedback and error handling
                     - The game remains mobile-friendly
                     - All code remains in one HTML file with no external dependencies
                     - Changes are properly tested and don't break existing features
                     
                     Return ONLY the complete HTML code, nothing else.`,
          },
        ],
      }),
    });

    // Create a new readable stream to forward Claude's response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No reader available");

          let gameContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            const lines = text.split('\n').filter(Boolean);

            for (const line of lines) {
              console.log('Processing line:', line); // Debug log
              
              if (!line.startsWith('data: ')) {
                controller.enqueue('data: {"type":"debug","message":"Skipping non-SSE line"}\n\n');
                continue;
              }
              
              try {
                const data = JSON.parse(line.slice(5));
                console.log('Parsed data:', data); // Debug log
                
                if (data.type === 'message_start') {
                  controller.enqueue('data: {"type":"content_block_start"}\n\n');
                } else if (data.type === 'content_block') {
                  const content = data.content[0]?.text || '';
                  if (content) {
                    gameContent += content;
                    controller.enqueue(`data: {"type":"content_block_delta","delta":{"type":"text_delta","text":${JSON.stringify(content)}}}\n\n`);
                  }
                } else if (data.type === 'message_stop') {
                  controller.enqueue('data: {"type":"content_block_stop"}\n\n');
                }
              } catch (e) {
                console.error('Error processing line:', e);
                controller.enqueue(`data: {"type":"error","message":"Error processing response: ${e.message}"}\n\n`);
              }
            }
          }

          console.log('Final game content length:', gameContent.length); // Debug log

          // Save the new version
          if (gameContent) {
            const newVersionNumber = currentVersion + 1;
            
            const { data: versionData, error: versionError } = await supabaseAdmin
              .from('game_versions')
              .insert([
                {
                  game_id: gameId,
                  code: gameContent,
                  instructions: "Game updated successfully",
                  version_number: newVersionNumber,
                }
              ])
              .select()
              .single();

            if (versionError) throw versionError;

            // Update current version in games table
            const { error: updateError } = await supabaseAdmin
              .from('games')
              .update({ current_version: newVersionNumber })
              .eq('id', gameId);

            if (updateError) throw updateError;

            console.log('Saved and set new version:', newVersionNumber);
          }

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in process-game-update function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
