
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    const { prompt, contentType } = await req.json();
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Get content type specific instructions
    let contentTypeInstructions = '';
    switch (contentType) {
      case 'game':
        contentTypeInstructions = 'a game with clear mechanics, visual style, and gameplay elements';
        break;
      case 'svg':
        contentTypeInstructions = 'an SVG graphic with clear design elements, colors, and structure';
        break;
      case 'webdesign':
        contentTypeInstructions = 'a web design with clear layout, style, and user experience considerations';
        break;
      case 'dataviz':
        contentTypeInstructions = 'a data visualization with clear data points, chart type, and visual elements';
        break;
      case 'diagram':
        contentTypeInstructions = 'a diagram with clear elements, connections, and visual hierarchy';
        break;
      case 'infographic':
        contentTypeInstructions = 'an infographic with clear information flow, visual elements, and data points';
        break;
      default:
        contentTypeInstructions = 'your request with specific details';
    }

    // Make request to Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Enhance this prompt to describe ${contentTypeInstructions} in more detail. Make it more specific and comprehensive, but maintain the user's original intent and ideas.
            
Original prompt: "${prompt}"

Return only the enhanced prompt text without any explanations or additional commentary.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const enhancedPrompt = data.content[0].text;

    return new Response(
      JSON.stringify({ enhancedPrompt }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error enhancing prompt:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
