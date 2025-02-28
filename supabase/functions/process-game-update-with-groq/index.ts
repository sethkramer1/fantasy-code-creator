
// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface RequestPayload {
  gameId: string;
  message: string;
  imageUrl?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { gameId, message, imageUrl } = await req.json() as RequestPayload

    // Validate the request
    if (!gameId || !message) {
      return new Response(
        JSON.stringify({ error: 'GameID and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get API Key from environment variable
    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      console.error('GROQ_API_KEY is not set')
      return new Response(
        JSON.stringify({ error: 'API key configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the game content
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('code, prompt, type')
      .eq('id', gameId)
      .single()

    if (gameError || !gameData) {
      console.error('Error fetching game:', gameError)
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing update with Groq for game: ${gameId}`)
    
    // Construct a comprehensive prompt with context
    const prompt = `
As an expert web developer, your task is to modify the following HTML/CSS/JS code based on the user's request.
Only modify what is necessary to implement the requested changes while maintaining the overall structure and functionality.

ORIGINAL PROMPT: ${gameData.prompt}
CURRENT CODE:
\`\`\`
${gameData.code}
\`\`\`

USER REQUEST: ${message}

Respond with ONLY the updated code. No explanations, no markdown, just the complete HTML/CSS/JS code to render the updated web page.
`.trim()

    // Define the model to use
    const model = "llama3-70b-8192"
    
    // Call the Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: 'You are an AI that modifies HTML, CSS, and JavaScript code based on user requests. Only respond with the complete modified code.' 
          },
          { 
            role: 'user', 
            content: prompt + (imageUrl ? ` (Reference image provided)` : '')
          }
        ],
        temperature: 0.5,
        max_tokens: 4096
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Groq API error:', errorData)
      throw new Error(`Groq API error: ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()
    let updatedCode = result.choices[0].message.content.trim()
    
    // Remove markdown code blocks if they exist
    if (updatedCode.startsWith('```') && updatedCode.endsWith('```')) {
      updatedCode = updatedCode
        .replace(/^```(?:html|javascript|js)?\n/, '')
        .replace(/```$/, '')
        .trim()
    }

    console.log('Successfully generated updated code')

    // Create a new version in the game_versions table
    const { data: currentVersionData, error: versionError } = await supabase
      .from('games')
      .select('current_version')
      .eq('id', gameId)
      .single()

    if (versionError) {
      console.error('Error fetching current version:', versionError)
      throw versionError
    }

    const newVersionNumber = (currentVersionData.current_version || 0) + 1

    // Insert the new version
    const { error: insertError } = await supabase
      .from('game_versions')
      .insert([
        {
          game_id: gameId,
          version_number: newVersionNumber,
          code: updatedCode,
          instructions: `Changes from request: "${message}"`
        }
      ])

    if (insertError) {
      console.error('Error inserting new version:', insertError)
      throw insertError
    }

    // Update the game with the new code and increment the version
    const { error: updateError } = await supabase
      .from('games')
      .update({
        code: updatedCode,
        current_version: newVersionNumber
      })
      .eq('id', gameId)

    if (updateError) {
      console.error('Error updating game:', updateError)
      throw updateError
    }

    // Add the message to game_messages
    const { error: messageError } = await supabase
      .from('game_messages')
      .insert([
        {
          game_id: gameId,
          message: message,
          response: "Changes applied successfully",
          image_url: imageUrl,
          model_type: "fast" // Indicating Groq model
        }
      ])

    if (messageError) {
      console.error('Error inserting message:', messageError)
      // Don't throw here, as this is not critical
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Changes applied successfully",
        newVersion: newVersionNumber
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
