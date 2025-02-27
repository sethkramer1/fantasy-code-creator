
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

    // Call Claude API
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
        messages: [
          {
            role: "user",
            content: `Here is the current HTML game code:\n\n${currentCode}\n\nPlease modify the game according to this request: ${message}\n\n
                     Return ONLY the complete HTML code, nothing else.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      throw new Error(`Claude API error: ${error}`);
    }

    let gameContent = '';

    // Read and process the stream
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        try {
          const data = JSON.parse(line.slice(5));
          if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
            const content = data.delta.text || '';
            if (content) {
              gameContent += content;
            }
          }
        } catch (e) {
          console.error('Error parsing line:', e);
        }
      }
    }

    if (!gameContent || !gameContent.includes('<html')) {
      throw new Error('Invalid game content received');
    }

    // Save new version
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

    return new Response(
      JSON.stringify({
        code: gameContent,
        instructions: "Game updated successfully",
        response: "Updates applied successfully",
        versionId: versionData.id
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

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
