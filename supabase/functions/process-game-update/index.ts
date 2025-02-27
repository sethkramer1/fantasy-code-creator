
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

// Function to extract Base64 data from a data URL
function extractBase64FromDataUrl(dataUrl: string): string {
  // Format is like: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error('Invalid data URL format');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { gameId, message, imageUrl } = await req.json()
    
    console.log('Received update request for game:', gameId);
    console.log('Message length:', message?.length || 0);
    console.log('Image provided:', imageUrl ? 'Yes' : 'No');

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.7.1')
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    
    // Fetch the current game code
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        code,
        prompt,
        type,
        current_version,
        game_versions (
          id,
          version_number,
          code
        )
      `)
      .eq('id', gameId)
      .single()
    
    if (gameError) {
      throw new Error(`Failed to fetch game: ${gameError.message}`)
    }
    
    if (!gameData) {
      throw new Error('Game not found')
    }
    
    console.log('Retrieved game data, current version:', gameData.current_version);
    
    // Get the current version code
    const currentVersionCode = gameData.game_versions.find(
      v => v.version_number === gameData.current_version
    )?.code || gameData.code
    
    // Define the system message
    const systemMessage = `You are an expert web developer, specializing in modifying existing web applications. 
You'll be given the HTML/CSS/JS code of a web application and a request to modify it.

1. Only return the complete, modified HTML/CSS/JS code as your response. Do not include explanations, comments about what you did, or markdown formatting.
2. Make sure your response is a fully functional standalone web application.
3. Make targeted changes based on the request, preserving the existing structure and functionality when not directly related to the request.
4. Your output must be valid HTML that can be directly set as the srcdoc of an iframe.
5. Never include \`\`\` markers, code block markers, or any explanation text.
6. Keep all original functionality working while adding the new features.
7. Preserve the original style and aesthetic unless specifically asked to change it.`;

    // Prepare the request body (removed "thinking" configuration as requested)
    let requestBody: any = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 30000,
      stream: true,
      system: systemMessage
    };

    // Handle the message content differently based on whether there's an image
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      console.log('Processing image data URL...');
      try {
        // Extract the base64 data from the data URL
        const base64Image = extractBase64FromDataUrl(imageUrl);
        console.log('Successfully extracted base64 data, length:', base64Image.length);
        
        const mediaType = imageUrl.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
        console.log('Detected media type:', mediaType);
        
        // Structure for image-with-text request
        requestBody.messages = [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This is the current code of the web application:

${currentVersionCode}

Modify this code according to this request: ${message}`
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Image
                }
              }
            ]
          }
        ];
      } catch (imageError) {
        console.error('Error processing image data URL:', imageError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to process image data',
            details: imageError instanceof Error ? imageError.message : 'Unknown error'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Structure for text-only request
      requestBody.messages = [
        {
          role: "user",
          content: `This is the current code of the web application:

${currentVersionCode}

Modify this code according to this request: ${message}`
        }
      ];
    }

    console.log('Sending request to Anthropic API with message structure:', 
      imageUrl ? 'Image + Text' : 'Text only');

    // Send the request to Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`)
    }
    
    console.log('Streaming response from Anthropic API');
    
    // Return the streaming response
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in process-game-update function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
