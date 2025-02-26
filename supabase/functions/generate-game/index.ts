
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  try {
    const { prompt } = await req.json()
    
    console.log('Generating game with prompt:', prompt)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 20000,
        stream: true,
        thinking: {
          type: "enabled",
          budget_tokens: 16000
        },
        messages: [
          {
            role: 'user',
            content: `Create a simple HTML5 game based on this description: ${prompt}. 
                     The game MUST:
                     - Have a clear "Start" or "Play" button to begin the game
                     - Include proper game controls that are explained to the player
                     - Handle game over conditions and allow restarting
                     - Include score tracking if applicable
                     - Work completely standalone with no external dependencies
                     - Have all code (HTML, CSS, JavaScript) in one file
                     - Include proper error handling and state management
                     - Be mobile-friendly with touch controls where applicable
                     - Have clear visual feedback for player actions
                     
                     Return ONLY the raw HTML that will be directly embedded in an iframe.
                     Do NOT wrap the code in \`\`\`html or any other markdown tags.
                     Include DOCTYPE and meta tags.
                     The game should work immediately when loaded in an iframe.`,
          },
        ]
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Anthropic API error:', error)
      throw new Error(`Anthropic API error: ${error}`)
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Error in generate-game function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
