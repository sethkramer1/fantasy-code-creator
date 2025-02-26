
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

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

    const { prompt } = await req.json()
    if (!prompt) {
      throw new Error('Prompt is required')
    }

    // Create a TransformStream for streaming
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Send initial message to confirm connection
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`))

    // Start game generation in the background
    EdgeRuntime.waitUntil((async () => {
      const encoder = new TextEncoder()
      try {
        console.log('Making request to Anthropic API with prompt:', prompt)
        
        // First API call to generate the game
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
                content: `Create a simple HTML5 game based on this description: ${prompt}. 
                         Return ONLY the complete HTML code that can be embedded in an iframe.
                         The game should work standalone without any external dependencies.`,
              },
            ],
          }),
        })

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
        }

        console.log('Anthropic API response status:', response.status)
        
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No reader available')

        let gameCode = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = new TextDecoder().decode(value)
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(5))
                console.log('Received event from Anthropic:', data)

                if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                  gameCode += data.delta.text
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'code', 
                    content: data.delta.text 
                  })}\n\n`))
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError, line)
              }
            }
          }
        }

        // Get instructions after game code is complete
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

        if (!instructionsResponse.ok) {
          throw new Error(`Instructions API error: ${instructionsResponse.status}`)
        }

        const instructionsData = await instructionsResponse.json()
        console.log('Instructions response:', instructionsData)

        const instructionsContent = instructionsData.content?.find(item => item.type === 'text')
        const instructions = instructionsContent?.text?.trim() || ''

        // Send the final complete response
        await writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'complete', 
          gameCode, 
          instructions 
        })}\n\n`))
      } catch (error) {
        console.error('Error generating game:', error)
        await writer.write(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error.message 
        })}\n\n`))
      } finally {
        await writer.close()
      }
    })())

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
