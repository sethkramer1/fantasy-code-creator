
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

    if (gameError) {
      console.error('Error fetching game:', gameError);
      throw gameError;
    }
    if (!gameData) {
      console.error('No game data found for id:', gameId);
      throw new Error('Game not found');
    }

    const currentVersion = gameData.current_version;
    const currentCode = gameData.game_versions[0].code;

    console.log('Current game version:', currentVersion);
    console.log('Current code length:', currentCode.length);
    console.log('First 100 chars of code:', currentCode.substring(0, 100));

    // Stream the response from Claude
    const promptData = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 20000,
      stream: true,
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
    };

    console.log('Sending request to Claude with prompt length:', promptData.messages[0].content.length);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(promptData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status} ${errorText}`);
    }

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
            console.log('Received chunk from Claude:', text); // Debug raw response

            const lines = text.split('\n').filter(Boolean);

            for (const line of lines) {
              if (!line.startsWith('data: ')) {
                console.log('Skipping non-SSE line:', line);
                continue;
              }
              
              try {
                const data = JSON.parse(line.slice(5));
                
                if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                  const content = data.delta.text || '';
                  if (content) {
                    gameContent += content;
                    controller.enqueue(line + '\n');
                    console.log('Added content chunk, current length:', gameContent.length);
                  }
                } else {
                  controller.enqueue(line + '\n');
                }
              } catch (e) {
                console.error('Error parsing line:', e);
                controller.enqueue(`data: {"type":"error","message":"Error processing response: ${e.message}"}\n\n`);
              }
            }
          }

          console.log('Final game content length:', gameContent.length);
          console.log('First 100 chars of final content:', gameContent.substring(0, 100));

          // Save the new version only if we got content
          if (gameContent && gameContent.includes('<html')) {
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

            if (versionError) {
              console.error('Error saving new version:', versionError);
              throw versionError;
            }

            // Update current version in games table
            const { error: updateError } = await supabaseAdmin
              .from('games')
              .update({ current_version: newVersionNumber })
              .eq('id', gameId);

            if (updateError) {
              console.error('Error updating game version:', updateError);
              throw updateError;
            }

            console.log('Successfully saved new version:', newVersionNumber);
          } else {
            console.error('Invalid game content received:', gameContent.substring(0, 100));
            throw new Error('Invalid game content received from Claude');
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
