
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

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
    const { gameId, prompt, imageUrl, userId } = await req.json();
    
    if (!gameId) {
      return new Response(
        JSON.stringify({ error: 'gameId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received request for gameId:', gameId);
    console.log('Prompt length:', prompt?.length || 0);
    console.log('Full prompt:', prompt); // Log the full prompt for debugging
    console.log('Image URL provided:', imageUrl ? 'Yes (data URL)' : 'No');
    console.log('User ID provided:', userId ? 'Yes' : 'No');

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the current game to get context
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();  // Use maybeSingle instead of single to avoid errors

    if (gameError) {
      console.error('Error fetching game:', gameError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch game data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!gameData) {
      console.error('Game not found for id:', gameId);
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch previous messages for context
    const { data: messagesData, error: messagesError } = await supabase
      .from('game_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Create a context from previous messages
    const conversationContext = messagesData 
      ? messagesData.map(msg => `User: ${msg.message}\n${msg.response ? `AI: ${msg.response}` : ''}`).join('\n\n')
      : '';

    // Assemble the full prompt with context - this is critical for the user input to flow through
    const fullPrompt = `
You're helping modify this code. Please update it according to this request: "${prompt}"

Game info:
- Original prompt: ${gameData.prompt}
- Type: ${gameData.type || 'Not specified'}

${conversationContext ? `\nPrevious conversation context:\n${conversationContext}` : ''}

Please make the changes requested while preserving the overall structure and functionality.
Return only the full new HTML code with all needed CSS and JavaScript embedded. Do not include any markdown formatting, explanation, or code blocks - ONLY return the raw HTML.
`;

    // Define the system message
    const systemMessage = `You are an expert developer specializing in web technologies. 
            
Important: Only return the raw HTML/CSS/JS code without any markdown code block syntax (no \`\`\`html or \`\`\` wrapping). Return ONLY the complete code that should be rendered in the iframe, nothing else.

After the code, please include a single line with token information in exactly this format:
"Tokens used: <input_count> input, <output_count> output"

Follow these structure requirements precisely and generate clean, semantic, and accessible code.`;

    // Prepare the request body with the correct structure for Claude 3.7 Sonnet
    let requestBody: any = {
      model: "claude-3-7-sonnet-20250219",
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
      console.log('Processing data URL image...');
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
                text: fullPrompt
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
          content: fullPrompt
        }
      ];
    }

    console.log('Sending request to Anthropic API with message structure:', 
      imageUrl ? 'Image + Text' : 'Text only');
    console.log('Using model:', requestBody.model);
    console.log('System message is properly set with length:', systemMessage.length);

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
    
    // For non-streaming responses, let's try to track the tokens here directly
    if (!requestBody.stream) {
      try {
        const responseData = await response.json();
        const content = responseData.content.join('');
        
        // Extract token information directly from the response
        const inputTokens = responseData.usage?.input_tokens;
        const outputTokens = responseData.usage?.output_tokens;
        
        if (inputTokens && outputTokens && gameId) {
          console.log(`[TOKEN TRACKING] Captured token usage - Input: ${inputTokens}, Output: ${outputTokens}`);
          
          // Create a message record for this token usage
          const { data: messageData, error: messageError } = await supabase
            .from('game_messages')
            .insert({
              game_id: gameId,
              message: "API Token Tracking",
              response: "Token tracking from Edge Function",
              is_system: true,
              model_type: 'claude'
            })
            .select('id')
            .single();
            
          if (messageError) {
            console.error('[TOKEN TRACKING] Error creating message record:', messageError);
          } else if (messageData?.id) {
            // Create a token usage record
            const { error: tokenError } = await supabase
              .from('token_usage')
              .insert({
                game_id: gameId,
                message_id: messageData.id,
                prompt: prompt.substring(0, 5000),
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                model_type: 'claude',
                user_id: userId
              });
              
            if (tokenError) {
              console.error('[TOKEN TRACKING] Error creating token usage record:', tokenError);
            } else {
              console.log('[TOKEN TRACKING] Token usage recorded from edge function');
            }
          }
        }
        
        // Create a new response with the same content
        return new Response(JSON.stringify(responseData), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          }
        });
      } catch (tokenError) {
        console.error('[TOKEN TRACKING] Error processing token information:', tokenError);
        // Continue with the streaming response if we can't process tokens
      }
    }
    
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in process-game-update function:', error);
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
