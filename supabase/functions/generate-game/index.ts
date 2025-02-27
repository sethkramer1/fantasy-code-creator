
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return base64;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  try {
    const { prompt, imageUrl } = await req.json()
    
    console.log('Generating content with prompt:', prompt)

    let messages = [];
    
    if (imageUrl) {
      console.log('Image URL provided, fetching and converting to base64...');
      const base64Image = await fetchImageAsBase64(imageUrl);
      
      messages = [
        {
          role: 'user',
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }
      ];
    } else {
      messages = [
        {
          role: 'user',
          content: prompt
        }
      ];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 30000,
        stream: true,
        system: `You are an expert developer specializing in web technologies, particularly in creating interactive web content, SVG graphics, data visualizations, and infographics. 
            
Important: Only return the raw HTML/CSS/JS code without any markdown code block syntax (no \`\`\`html or \`\`\` wrapping). Return ONLY the complete code that should be rendered in the iframe, nothing else.

Follow these structure requirements precisely and generate clean, semantic, and accessible code.`,
        messages: messages,
        thinking: {
          type: "enabled",
          budget_tokens: 7000
        }
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
