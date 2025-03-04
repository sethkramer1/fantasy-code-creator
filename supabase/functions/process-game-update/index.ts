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

function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error('Invalid data URL format');
}

serve(async (req) => {
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
    const { gameId, message, modelType, imageUrl, userId, stream, thinking } = await req.json();
    
    if (!gameId) {
      return new Response(
        JSON.stringify({ error: 'gameId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received request for gameId:', gameId);
    console.log('Message length:', message?.length || 0);
    console.log('Model type:', modelType || 'smart (default)');
    console.log('Image URL provided:', imageUrl ? 'Yes (data URL)' : 'No');
    console.log('User ID provided:', userId ? 'Yes' : 'No');
    console.log('Is initial generation:', message?.includes('Initial Generation') ? 'Yes' : 'No');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const isInitialGeneration = message?.includes('Initial Generation') || false;
    
    let initialMessageId = null;
    if (isInitialGeneration) {
      try {
        console.log('[TOKEN TRACKING] Creating initial message record for token tracking');
        
        const { data: messageData, error: messageError } = await supabase
          .from('game_messages')
          .insert({
            game_id: gameId,
            message: "Initial Generation",
            response: "Processing initial content...",
            is_system: true,
            model_type: modelType || 'smart'
          })
          .select('id')
          .single();
          
        if (messageError) {
          console.error('[TOKEN TRACKING] Error creating initial message:', messageError);
        } else if (messageData?.id) {
          initialMessageId = messageData.id;
          console.log('[TOKEN TRACKING] Created initial message for token tracking:', initialMessageId);
          
          const estimatedInputTokens = Math.ceil(message.length / 4);
          const estimatedOutputTokens = 1;
          
          console.log('[TOKEN TRACKING] Creating initial token record with estimated values');
          console.log(`[TOKEN TRACKING] Estimated input tokens: ${estimatedInputTokens}`);
          
          const { data: tokenData, error: tokenError } = await supabase
            .from('token_usage')
            .insert({
              user_id: userId,
              game_id: gameId,
              message_id: initialMessageId,
              prompt: message.substring(0, 5000),
              input_tokens: estimatedInputTokens,
              output_tokens: estimatedOutputTokens,
              model_type: modelType || 'smart'
            })
            .select('id')
            .single();
            
          if (tokenError) {
            console.error('[TOKEN TRACKING] Error creating initial token record:', tokenError);
          } else {
            console.log('[TOKEN TRACKING] Created initial token record:', tokenData.id);
          }
        }
      } catch (initError) {
        console.error('[TOKEN TRACKING] Error in initial message setup:', initError);
      }
    }

    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();

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

    const { data: messagesData, error: messagesError } = await supabase
      .from('game_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    const conversationContext = messagesData 
      ? messagesData.map(msg => `User: ${msg.message}\n${msg.response ? `AI: ${msg.response}` : ''}`).join('\n\n')
      : '';

    const fullPrompt = `
You're helping modify this code. Please update it according to this request: "${message}"

Game info:
- Original prompt: ${gameData.prompt}
- Type: ${gameData.type || 'Not specified'}

${conversationContext ? `\nPrevious conversation context:\n${conversationContext}` : ''}

Please make the changes requested while preserving the overall structure and functionality.
Return only the full new HTML code with all needed CSS and JavaScript embedded. Do not include any markdown formatting, explanation, or code blocks - ONLY return the raw HTML.
`;

    const systemMessage = `You are an expert developer specializing in web technologies. 
            
Important: Only return the raw HTML/CSS/JS code without any markdown code block syntax (no \`\`\`html or \`\`\` wrapping). Return ONLY the complete code that should be rendered in the iframe, nothing else.

After the code, please include a single line with token information in exactly this format:
"Tokens used: <input_count> input, <output_count> output"

Follow these structure requirements precisely and generate clean, semantic, and accessible code.`;

    let requestBody: any = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 30000,
      stream: stream,
      system: systemMessage,
      thinking: {
        type: "enabled",
        budget_tokens: 10000
      }
    };

    if (imageUrl && imageUrl.startsWith('data:image/')) {
      console.log('Processing data URL image...');
      try {
        const base64Image = extractBase64FromDataUrl(imageUrl);
        console.log('Successfully extracted base64 data, length:', base64Image.length);
        
        const mediaType = imageUrl.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
        console.log('Detected media type:', mediaType);
        
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
    
    if (!requestBody.stream) {
      try {
        const responseData = await response.json();
        const content = responseData.content.join('');
        
        const inputTokens = responseData.usage?.input_tokens;
        const outputTokens = responseData.usage?.output_tokens;
        
        if (inputTokens && outputTokens && gameId) {
          console.log(`[TOKEN TRACKING] Captured token usage - Input: ${inputTokens}, Output: ${outputTokens}`);
          
          const messageId = initialMessageId || `token-tracking-${gameId}-${Date.now()}`;
          
          if (!initialMessageId) {
            const { data: messageData, error: messageError } = await supabase
              .from('game_messages')
              .insert({
                game_id: gameId,
                message: "API Token Tracking",
                response: "Token tracking from Edge Function",
                is_system: true,
                model_type: modelType || 'smart'
              })
              .select('id')
              .single();
              
            if (messageError) {
              console.error('[TOKEN TRACKING] Error creating message record:', messageError);
            } else if (messageData?.id) {
              initialMessageId = messageData.id;
            }
          }
          
          if (initialMessageId) {
            const { data: existingToken, error: checkError } = await supabase
              .from('token_usage')
              .select('id')
              .eq('message_id', initialMessageId)
              .maybeSingle();
              
            if (checkError) {
              console.error('[TOKEN TRACKING] Error checking for existing token record:', checkError);
            }
            
            if (existingToken?.id) {
              const { error: updateError } = await supabase
                .from('token_usage')
                .update({
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  model_type: modelType || 'smart',
                  user_id: userId
                })
                .eq('id', existingToken.id);
                
              if (updateError) {
                console.error('[TOKEN TRACKING] Error updating token record:', updateError);
              } else {
                console.log('[TOKEN TRACKING] Updated existing token record with actual values');
              }
            } else {
              const { error: tokenError } = await supabase
                .from('token_usage')
                .insert({
                  game_id: gameId,
                  message_id: initialMessageId,
                  prompt: message.substring(0, 5000),
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  model_type: modelType || 'smart',
                  user_id: userId
                });
                
              if (tokenError) {
                console.error('[TOKEN TRACKING] Error creating token usage record:', tokenError);
              } else {
                console.log('[TOKEN TRACKING] Token usage recorded from edge function');
              }
            }
          }
        }
        
        return new Response(JSON.stringify(responseData), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          }
        });
      } catch (tokenError) {
        console.error('[TOKEN TRACKING] Error processing token information:', tokenError);
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
