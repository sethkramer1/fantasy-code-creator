
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
    console.log('Processing game update:', { gameId, message })
    
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

    console.log('Current game version:', currentVersion);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 20000,
        stream: true,
        system: `You are an expert web developer. Modify the provided code according to user requests.

Important: Return ONLY the complete HTML/CSS/JS code without any markdown code block syntax (no \`\`\`html or \`\`\` wrapping). The code should be ready to be rendered in an iframe directly.

Keep all features and code the same, except for the requested changes. Make modifications to update the content according to the request only.`,
        messages: [
         
          {
            role: "user",
            content: `Here is the current code:\n\n${currentCode}\n\nPlease modify according to this request: ${message}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    // Create a new TransformStream for streaming the response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start processing in the background
    (async () => {
      try {
        let gameContent = '';
        let currentChunk = '';
        let lineBuffer = '';

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        // Send initial message
        await writer.write(new TextEncoder().encode(
          `data: ${JSON.stringify({ type: 'content_block_start' })}\n\n`
        ));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          lineBuffer += text;
          
          // Process complete lines
          while (lineBuffer.includes('\n')) {
            const newlineIndex = lineBuffer.indexOf('\n');
            const line = lineBuffer.slice(0, newlineIndex);
            lineBuffer = lineBuffer.slice(newlineIndex + 1);

            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(5));
                if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                  const content = data.delta.text || '';
                  if (content) {
                    currentChunk += content;
                    gameContent += content;

                    // If we have a complete line or significant chunk, send it
                    if (content.includes('\n') || currentChunk.length > 50) {
                      await writer.write(new TextEncoder().encode(
                        `data: ${JSON.stringify({
                          type: 'content_block_delta',
                          delta: { type: 'text_delta', text: currentChunk }
                        })}\n\n`
                      ));
                      currentChunk = '';
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing line:', e);
              }
            }
          }
        }

        // Send any remaining content
        if (currentChunk) {
          await writer.write(new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: currentChunk }
            })}\n\n`
          ));
        }

        // Save new version if we got valid content
        if (gameContent && gameContent.includes('<html')) {
          const newVersionNumber = currentVersion + 1;
          
          const { data: versionData, error: versionError } = await supabaseAdmin
            .from('game_versions')
            .insert([{
              game_id: gameId,
              code: gameContent,
              instructions: "Game updated successfully",
              version_number: newVersionNumber,
            }])
            .select()
            .single();

          if (versionError) throw versionError;

          await supabaseAdmin
            .from('games')
            .update({ current_version: newVersionNumber })
            .eq('id', gameId);

          console.log('Successfully saved new version:', newVersionNumber);
        } else {
          throw new Error('Invalid game content received');
        }

        // Send completion message
        await writer.write(new TextEncoder().encode(
          `data: ${JSON.stringify({ type: 'content_block_stop' })}\n\n`
        ));
      } catch (error) {
        console.error('Stream processing error:', error);
        const errorMessage = `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`;
        await writer.write(new TextEncoder().encode(errorMessage));
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Error in process-game-update function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})
