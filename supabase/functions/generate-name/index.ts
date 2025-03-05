
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

serve(async (req) => {
  // Log request received
  console.log("generate-name function invoked");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
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
    console.log("Parsing request body");
    const reqBody = await req.text();
    console.log("Request body received:", reqBody.substring(0, 200) + '...');
    
    let promptData;
    try {
      promptData = JSON.parse(reqBody);
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Using claude-3-haiku-20240307 as the default model instead of claude-3-5-sonnet
    const { prompt, model = "claude-3-haiku-20240307" } = promptData;
    
    console.log("Received request to generate name.");
    console.log("Prompt length:", prompt?.length || 0);
    console.log("Model:", model);
    console.log("Prompt preview:", prompt?.substring(0, 100) + "...");
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
      console.error('Invalid or empty prompt received');
      return new Response(
        JSON.stringify({ error: 'Valid prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define a system message for generating a game name
    const systemMessage = `You are a creative naming expert. Your task is to generate a short, catchy, and memorable name for a game or web design based on the user's description.
The name should be:
- Brief (1-5 words maximum)
- Catchy and memorable
- Relevant to the content described
- Creative and unique
- Suitable for a URL or title

Return ONLY the name with no explanations, quotes, or additional text.`;

    // Make the request to Anthropic API
    console.log('Sending request to Anthropic API with model:', model);
    console.log('API endpoint: https://api.anthropic.com/v1/messages');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 100,
        system: systemMessage,
        messages: [
          {
            role: "user",
            content: `Generate a short, catchy name for this game or web design: ${prompt}`
          }
        ],
      }),
    });

    console.log('Anthropic API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error response status:', response.status);
      console.error('Anthropic API error response text:', errorText);
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('Anthropic API responded successfully, parsing response');
    const responseText = await response.text();
    console.log('Response text preview:', responseText.substring(0, 200) + '...');
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Anthropic API response as JSON:', parseError);
      console.error('Response text:', responseText);
      throw new Error('Failed to parse Anthropic API response');
    }
    
    console.log('Parsed JSON response successfully');
    
    // Extract the name from the response
    const generatedName = data.content && data.content[0] && data.content[0].text 
      ? data.content[0].text.trim() 
      : '';
    
    console.log('Generated name:', generatedName);
    
    // Return the generated name
    const responseObj = { name: generatedName };
    console.log('Returning response:', JSON.stringify(responseObj));
    
    return new Response(
      JSON.stringify(responseObj),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in generate-name function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to generate game name'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 
