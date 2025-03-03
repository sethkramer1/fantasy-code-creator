
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const requestData = await req.json();
    const { prompt, imageUrl, contentType, system, partialResponse, model = "claude-3-7-sonnet-20250219" } = requestData;
    
    console.log("Received request with prompt:", prompt);
    console.log("Prompt raw:", prompt);
    console.log("Prompt length:", prompt?.length || 0);
    console.log("Content type:", contentType);
    console.log("Model:", model);
    console.log("System prompt provided:", system ? "Yes" : "No");
    console.log("Image URL provided:", imageUrl ? "Yes" : "No");
    console.log("Partial response provided:", partialResponse ? "Yes" : "No");
    
    // Check that prompt is valid before proceeding
    if (!prompt || prompt === "Loading..." || prompt.trim() === "") {
      console.error('Invalid or empty prompt received:', prompt);
      return new Response(
        JSON.stringify({ 
          error: 'Valid prompt is required, received: ' + prompt,
          details: 'A non-empty prompt is required to generate content'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define a default system message if none provided
    const systemMessage = system || `You are an expert developer specializing in web technologies. 
You are tasked with creating HTML/CSS/JS code based on the user's request.
Return only the complete HTML code that's ready to be displayed in a browser.
Include all CSS and JavaScript within the HTML file.
Do not include any explanations, markdown formatting or code blocks - only return the actual code.`;

    // Prepare the request body with the correct structure for Claude 3.7 Sonnet
    let requestBody: any = {
      model: model,
      max_tokens: 30000,
      stream: true,
      system: systemMessage,
      thinking: {
        type: "enabled",
        budget_tokens: 10000
      }
    };

    // Handle the message content differently based on whether there's an image
    if (imageUrl && imageUrl.startsWith('data:image/')) {
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
                text: partialResponse 
                  ? `${prompt}\n\nUse this as a starting point:\n${partialResponse}`
                  : prompt
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
          JSON.stringify({ error: 'Failed to process image data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Structure for text-only request
      const messageText = partialResponse 
        ? `${prompt}\n\nUse this as a starting point:\n${partialResponse}` 
        : prompt;
        
      requestBody.messages = [
        {
          role: "user",
          content: messageText
        }
      ];
    }

    console.log('Sending request to Anthropic API with Claude 3.7 Sonnet');
    console.log('Request body message contents:', requestBody.messages);

    // Make the request to Anthropic
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

    console.log('Successfully got response from Anthropic API, streaming back to client');
    
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
