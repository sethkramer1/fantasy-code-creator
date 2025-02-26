
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getCodeChanges(currentCode: string, message: string) {
  // First, analyze where changes need to be made
  const analysisResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Analyze this HTML game code and this modification request: "${message}"

First, identify which part of the code needs to be modified to implement this change.
Then, provide ONLY:
1. A brief description of what needs to be changed
2. The start string that uniquely identifies where the change begins
3. The end string that uniquely identifies where the change ends

Format your response like this:
DESCRIPTION: <brief description>
START: <unique string before change>
END: <unique string after change>

Code:
${currentCode}`
        },
      ],
    }),
  });

  if (!analysisResponse.ok) {
    throw new Error(`Analysis API error: ${analysisResponse.status}`);
  }

  const analysisData = await analysisResponse.json();
  const analysis = analysisData.content[0].text;

  // Parse the analysis
  const descMatch = analysis.match(/DESCRIPTION: (.*)/);
  const startMatch = analysis.match(/START: (.*)/);
  const endMatch = analysis.match(/END: (.*)/);

  if (!descMatch || !startMatch || !endMatch) {
    throw new Error("Could not parse analysis response");
  }

  // Now get the specific code changes for just that section
  const updateResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Given this HTML game code section that needs to be modified:

${currentCode.substring(
  currentCode.indexOf(startMatch[1]),
  currentCode.indexOf(endMatch[1]) + endMatch[1].length
)}

Modify it according to this request: ${message}

Return ONLY the new code that should replace this section.`
        },
      ],
    }),
  });

  if (!updateResponse.ok) {
    throw new Error(`Update API error: ${updateResponse.status}`);
  }

  const updateData = await updateResponse.json();
  const newCodeSection = updateData.content[0].text;

  // Replace the section in the full code
  const newCode = currentCode.replace(
    currentCode.substring(
      currentCode.indexOf(startMatch[1]),
      currentCode.indexOf(endMatch[1]) + endMatch[1].length
    ),
    newCodeSection
  );

  return {
    description: descMatch[1],
    newCode,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with admin privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

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

    // Get optimized code changes
    const { description, newCode } = await getCodeChanges(currentCode, message);

    // Get new instructions
    const instructionsResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get('ANTHROPIC_API_KEY') ?? '',
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
        response: `I've updated the game: ${description}. Try it out!`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
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
