
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

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
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }

    const { prompt } = await req.json()
    if (!prompt) {
      throw new Error('Prompt is required')
    }

    console.log('Generating game with prompt:', prompt)

    // First API call to generate the game
    const gameResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 20000,
        thinking: {
          type: "enabled",
          budget_tokens: 10000,
        },
        messages: [
          {
            role: "user",
            content: `Create a simple HTML5 game based on this description: ${prompt}. 
                     Return ONLY the complete HTML code that can be embedded in an iframe.
                     The game should work standalone without any external dependencies.`,
          },
        ],
      }),
    })

    const gameData = await gameResponse.json()
    console.log('Received game response from Anthropic:', gameData)

    if (gameData.error) {
      throw new Error(gameData.error.message || 'Error from Anthropic API')
    }

    const textContent = gameData.content?.find(item => item.type === 'text')
    if (!textContent || !textContent.text) {
      throw new Error('No text content found in response')
    }

    const gameCode = textContent.text.trim()

    // Second API call to get instructions
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
            content: `Given this game code, explain ONLY the controls and how to play the game in a clear, concise way. No other information needed:\n\n${gameCode}`,
          },
        ],
      }),
    })

    const instructionsData = await instructionsResponse.json()
    console.log('Received instructions response from Anthropic:', instructionsData)

    if (instructionsData.error) {
      throw new Error(instructionsData.error.message || 'Error from Anthropic API')
    }

    const instructionsContent = instructionsData.content?.find(item => item.type === 'text')
    if (!instructionsContent || !instructionsContent.text) {
      throw new Error('No instructions content found in response')
    }

    const instructions = instructionsContent.text.trim()

    return new Response(JSON.stringify({ gameCode, instructions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
