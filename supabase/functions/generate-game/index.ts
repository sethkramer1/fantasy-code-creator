
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get the API key from environment variables
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Check if API key is available
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse the request body
    const requestData = await req.json();
    const { 
      prompt, 
      system = "", 
      stream = true,
      model = "claude-3-7-sonnet-20250219"
    } = requestData;
    
    console.log("Received request with prompt length:", prompt?.length || 0);
    console.log("Model:", model);
    console.log("System prompt provided:", system ? "Yes" : "No");
    console.log("Stream mode:", stream ? "Enabled" : "Disabled");

    // Validate the prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
      console.error('Invalid or empty prompt received:', prompt);
      return new Response(
        JSON.stringify({ 
          error: 'Valid prompt is required',
          details: 'A non-empty prompt is required to generate content'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define the system prompt if not provided
    const systemPrompt = system || `You are an expert web developer. Your task is to create a beautiful and functional website based on the user's prompt.

Create valid HTML, CSS, and JavaScript code that follows best practices.
- Use semantic HTML5 elements
- Write clean, efficient CSS
- Create responsive designs that work across all device sizes
- Follow accessibility best practices
- Write clean, modern JavaScript
- Do not reference external files or resources

Your output should be a complete, self-contained HTML file with inline CSS and JavaScript.`;

    // Prepare the request body for Claude 3.7 Sonnet
    const requestBody = {
      model: model,
      max_tokens: 30000,
      stream: stream,
      system: systemPrompt,
      thinking: {
        type: "enabled",
        budget_tokens: 15000
      },
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    console.log('Sending request to Anthropic API');

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

    console.log('Successfully got response from Anthropic API');
    
    // For streaming responses, pipe directly to client
    if (stream && response.body) {
      console.log('Streaming response back to client');
      
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // For non-streaming responses, return the JSON
      console.log('Processing non-streaming response');
      const data = await response.json();
      const content = data.content[0]?.text || '';
      
      return new Response(
        JSON.stringify({ content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in generate-game function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
