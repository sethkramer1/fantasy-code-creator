
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
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  } catch (error) {
    console.error('Error fetching image:', error);
    throw error;
  }
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
    
    console.log('Received request with prompt:', prompt)
    console.log('Image URL:', imageUrl)

    // Define the system message
    const systemMessage = `You are an expert developer specializing in web technologies, particularly in creating interactive web content, SVG graphics, data visualizations, and infographics. 
            
Important: Only return the raw HTML/CSS/JS code without any markdown code block syntax (no \`\`\`html or \`\`\` wrapping). Return ONLY the complete code that should be rendered in the iframe, nothing else.

Follow these structure requirements precisely and generate clean, semantic, and accessible code.`;

    // Prepare the request body with the correct structure
    let requestBody = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 30000,
      stream: true,
      system: systemMessage,
      messages: [],
      thinking: {
        type: "enabled",
        budget_tokens: 7000
      }
    };

    // Handle the message content differently based on whether there's an image
    if (imageUrl) {
      console.log('Converting image to base64...');
      try {
        const base64Image = await fetchImageAsBase64(imageUrl);
        console.log('Successfully converted image to base64');
        
        // Structure for image-with-text request
        requestBody.messages = [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }
        ];
      } catch (imageError) {
        console.error('Error processing image:', imageError);
        throw imageError;
      }
    } else {
      // Structure for text-only request
      requestBody.messages = [
        {
          role: "user",
          content: prompt
        }
      ];
    }

    console.log('Sending request to Anthropic API');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error response:', errorText);
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('Successfully got response from Anthropic API');

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in generate-game function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
