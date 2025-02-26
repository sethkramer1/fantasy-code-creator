
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

    const { gameId, message } = await req.json()
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
      .single();

    if (gameError) throw gameError;
    if (!gameData) throw new Error('Game not found');

    const currentVersion = gameData.current_version;
    const currentCode = gameData.game_versions[0].code;
    const currentInstructions = gameData.game_versions[0].instructions;

    // Ask Claude to modify the game
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
        messages: [
          {
            role: "user",
            content: `Here is the current HTML game code:\n\n${currentCode}\n\nPlease modify the game according to this request: ${message}\n\nReturn ONLY the complete updated HTML code.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const anthropicData = await response.json();
    const newCode = anthropicData.content[0].text;

    // Get new instructions
    const instructionsResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Given this game code, explain ONLY the controls and how to play the game in a clear, concise way:\n\n${newCode}`,
          },
        ],
      }),
    });

    if (!instructionsResponse.ok) {
      throw new Error(`Instructions API error: ${instructionsResponse.status}`);
    }

    const instructionsData = await instructionsResponse.json();
    const newInstructions = instructionsData.content[0].text;

    // Save new version
    const newVersionNumber = currentVersion + 1;
    
    const { data: versionData, error: versionError } = await supabaseAdmin
      .from('game_versions')
      .insert([
        {
          game_id: gameId,
          code: newCode,
          instructions: newInstructions,
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
        code: newCode,
        instructions: newInstructions,
        versionId: versionData.id,
        response: "I've updated the game based on your request. Try it out!"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
