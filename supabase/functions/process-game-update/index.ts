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

function isTokenInfo(text) {
  if (!text) return false;
  
  return (
    text.includes("Tokens used:") ||
    text.includes("Token usage:") ||
    text.includes("input tokens") ||
    text.includes("output tokens") ||
    /\d+\s*input\s*,\s*\d+\s*output/.test(text) || 
    /\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens/.test(text) ||
    /input:?\s*\d+\s*,?\s*output:?\s*\d+/.test(text) ||
    /\b(input|output)\b.*?\b\d+\b/.test(text)
  );
}

function removeTokenInfo(content) {
  if (!content) return content;
  
  content = content.replace(/Tokens used:.*?(input|output).*?\n/g, '');
  content = content.replace(/Token usage:.*?(input|output).*?\n/g, '');
  content = content.replace(/.*?\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens.*?\n/g, '');
  content = content.replace(/.*?\d+\s*input\s*,\s*\d+\s*output.*?\n/g, '');
  content = content.replace(/.*?input:?\s*\d+\s*,?\s*output:?\s*\d+.*?\n/g, '');
  
  content = content.replace(/Tokens used:.*?(input|output).*?(?=\s)/g, '');
  content = content.replace(/Token usage:.*?(input|output).*?(?=\s)/g, '');
  content = content.replace(/\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens/g, '');
  content = content.replace(/\d+\s*input\s*,\s*\d+\s*output/g, '');
  content = content.replace(/input:?\s*\d+\s*,?\s*output:?\s*\d+/g, '');
  
  content = content.replace(/input tokens:.*?output tokens:.*?(?=\s)/g, '');
  content = content.replace(/input:.*?output:.*?(?=\s)/g, '');
  content = content.replace(/\b\d+ tokens\b/g, '');
  content = content.replace(/\btokens: \d+\b/g, '');
  
  content = content.replace(/\b\d+ input\b/g, '');
  content = content.replace(/\b\d+ output\b/g, '');
  
  return content.trim();
}

function generateTokenTrackingMessageId(gameId: string): string {
  return `token-tracking-${gameId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

async function createInitialTokenRecords(
  supabase: any, 
  gameId: string, 
  userId: string | undefined, 
  prompt: string, 
  modelType: string,
  estimatedInputTokens: number
) {
  try {
    if (!gameId) {
      console.error('[TOKEN TRACKING] Cannot create token records: gameId is required');
      return null;
    }
    
    const messageId = generateTokenTrackingMessageId(gameId);
    console.log(`[TOKEN TRACKING] Creating initial token records for game ${gameId}, model ${modelType}`);
    console.log(`[TOKEN TRACKING] Estimated input tokens: ${estimatedInputTokens}`);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('token_usage')
      .insert({
        user_id: userId,
        game_id: gameId,
        message_id: messageId,
        prompt: prompt.substring(0, 5000),
        input_tokens: estimatedInputTokens,
        output_tokens: 1,
        model_type: modelType
      })
      .select('id')
      .single();
      
    if (tokenError) {
      console.error('[TOKEN TRACKING] Error creating initial token record:', tokenError);
      return null;
    }
    
    console.log('[TOKEN TRACKING] Created initial token record with ID:', tokenData.id);
    return { messageId, tokenRecordId: tokenData.id };
  } catch (error) {
    console.error('[TOKEN TRACKING] Error in createInitialTokenRecords:', error);
    return null;
  }
}

async function updateTokenRecords(
  supabase: any,
  messageId: string,
  inputTokens: number,
  outputTokens: number
) {
  try {
    if (!messageId) {
      console.error('[TOKEN TRACKING] Cannot update token records: messageId is required');
      return false;
    }
    
    console.log(`[TOKEN TRACKING] Updating token records for message ${messageId}`);
    console.log(`[TOKEN TRACKING] Final token counts - Input: ${inputTokens}, Output: ${outputTokens}`);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('token_usage')
      .update({
        input_tokens: inputTokens,
        output_tokens: outputTokens
      })
      .eq('message_id', messageId)
      .select('id')
      .single();
      
    if (tokenError) {
      console.error('[TOKEN TRACKING] Error updating token record:', tokenError);
      return false;
    }
    
    console.log('[TOKEN TRACKING] Updated token record with ID:', tokenData.id);
    return true;
  } catch (error) {
    console.error('[TOKEN TRACKING] Error in updateTokenRecords:', error);
    return false;
  }
}

async function processAnthropicStream(reader, writer, supabase, gameId, estimatedInputTokens, tokenTrackingInfo) {
  let fullContent = '';
  let completeChunk = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        const finalOutputTokens = Math.max(1, Math.ceil(completeChunk.length / 4));
        console.log('[TOKEN TRACKING] Final output tokens (estimated):', finalOutputTokens);
        
        if (tokenTrackingInfo && tokenTrackingInfo.messageId) {
          await updateTokenRecords(
            supabase,
            tokenTrackingInfo.messageId,
            estimatedInputTokens,
            finalOutputTokens
          );
          
          const tokenInfoEvent = `data: ${JSON.stringify({
            type: 'token_usage',
            usage: {
              input_tokens: estimatedInputTokens,
              output_tokens: finalOutputTokens
            }
          })}\n\n`;
          
          await writer.write(new TextEncoder().encode(tokenInfoEvent));
        }
        
        await writer.write(new TextEncoder().encode('data: [DONE]\n\n'));
        await writer.close();
        
        fullContent = removeTokenInfo(fullContent);
        
        const { error: updateGameError } = await supabase
          .from('games')
          .update({
            code: fullContent
          })
          .eq('id', gameId);
        
        if (updateGameError) {
          console.error(`Error updating game: ${updateGameError.message}`);
        } else {
          console.log(`Updated game ${gameId} with new content from stream (version creation handled by client)`);
        }
        
        break;
      }
      
      const chunk = new TextDecoder().decode(value);
      
      await processChunkLines(chunk, writer, completeChunk, fullContent);
    }
  } catch (streamError) {
    console.error('[STREAM ERROR]', streamError);
    writer.abort(streamError);
  }
}

async function processChunkLines(chunk, writer, completeChunk, fullContent) {
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const eventData = line.slice(5).trim();
        
        if (eventData === '[DONE]') {
          await writer.write(new TextEncoder().encode(line + '\n'));
          continue;
        }
        
        if (eventData.startsWith('{')) {
          const data = JSON.parse(eventData);
          
          if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
            continue;
          }
          
          if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta' && data.delta.text) {
            let contentText = data.delta.text;
            
            if (isTokenInfo(contentText)) {
              if (contentText.trim().length === 0) {
                continue;
              }
              
              contentText = removeTokenInfo(contentText);
              if (!contentText.trim()) {
                continue;
              }
              
              data.delta.text = contentText;
            }
            
            completeChunk += contentText;
            fullContent += contentText;
          }
          
          await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        } else {
          await writer.write(new TextEncoder().encode(line + '\n'));
        }
      } catch (parseError) {
        console.error('Error parsing stream event:', parseError);
        await writer.write(new TextEncoder().encode(line + '\n'));
      }
    } else if (line.trim()) {
      await writer.write(new TextEncoder().encode(line + '\n'));
    }
  }
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

    const { data: latestVersion, error: versionError } = await supabase
      .from('game_versions')
      .select('*')
      .eq('game_id', gameId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      console.error('Error fetching latest game version:', versionError);
    }

    if (latestVersion) {
      console.log('Found latest version:', {
        version_number: latestVersion.version_number,
        has_code: !!latestVersion.code,
        code_length: latestVersion.code?.length || 0
      });
    } else {
      console.log('No versions found for this game, will use game code directly');
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

    const currentCode = (latestVersion && latestVersion.code) ? latestVersion.code : (gameData.code || '');

    console.log('Current code available:', !!currentCode);
    console.log('Current code length:', currentCode.length || 0);
    
    if (!currentCode || currentCode.length < 10) {
      console.warn('WARNING: Current code is very short or empty. This may cause issues with the AI response.');
    }

    const systemMessage = `You are an expert developer specializing in web technologies. You will be modifying the following code base:

Current code:
${currentCode}

Code info:
- Original prompt: ${gameData.prompt}
- Type: ${gameData.type || 'Not specified'}

Important: Only return the raw HTML/CSS/JS code without any markdown code block syntax (no \`\`\`html or \`\`\` wrapping). Return ONLY the complete code that should be rendered in the iframe, nothing else.

DO NOT include any token information in your response. Do not add comments about token usage or any metrics.

Follow these structure requirements precisely and generate clean, semantic, and accessible code.`;

    let messages: any[] = [];
    
    if (messagesData && messagesData.length > 0) {
      for (const msg of messagesData) {
        if (msg.image_url && msg.image_url.startsWith('data:image/')) {
          try {
            const base64Image = extractBase64FromDataUrl(msg.image_url);
            const mediaType = msg.image_url.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
            
            messages.push({
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Image
                  }
                },
                {
                  type: "text",
                  text: msg.message
                }
              ]
            });
          } catch (imageError) {
            console.error('Error processing historical image:', imageError);
            messages.push({
              role: "user",
              content: msg.message
            });
          }
        } else {
          messages.push({
            role: "user",
            content: msg.message
          });
        }
        
        if (msg.response) {
          messages.push({
            role: "assistant",
            content: msg.response
          });
        }
      }
    }
    
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      console.log('Processing data URL image...');
      try {
        const base64Image = extractBase64FromDataUrl(imageUrl);
        console.log('Successfully extracted base64 data, length:', base64Image.length);
        
        const mediaType = imageUrl.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
        console.log('Detected media type:', mediaType);
        
        messages.push({
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: "text",
              text: message
            }
          ]
        });
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
      messages.push({
        role: "user",
        content: message
      });
    }

    let requestBody: any = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 30000,
      stream: stream,
      system: systemMessage,
      messages: messages,
      thinking: {
        type: "enabled",
        budget_tokens: 10000
      }
    };

    console.log('Streaming mode:', stream ? 'Enabled' : 'Disabled');
    console.log('Thinking mode:', requestBody.thinking ? `Enabled (budget: ${requestBody.thinking.budget_tokens})` : 'Disabled');

    console.log('=== DEBUG: COMPLETE REQUEST BODY ===');
    console.log('System message length:', systemMessage.length);
    if (systemMessage.length > 1000) {
      console.log('System message first 500 chars:', systemMessage.substring(0, 500));
      console.log('Current code preview (first 500 chars):', currentCode.substring(0, 500));
      console.log('Current code preview (last 500 chars):', currentCode.substring(Math.max(0, currentCode.length - 500)));
    } else {
      console.log('WARNING: System message is suspiciously short:', systemMessage);
    }
    console.log('Number of messages:', messages.length);
    if (messages.length > 0) {
      console.log('Last message content:', messages[messages.length - 1].content);
    }
    console.log('=== END DEBUG ===');

    const estimatedInputTokens = Math.ceil((systemMessage.length + JSON.stringify(messages).length) / 4);
    let tokenTrackingInfo = null;
    
    if (gameId) {
      tokenTrackingInfo = await createInitialTokenRecords(
        supabase, 
        gameId, 
        userId, 
        systemMessage + JSON.stringify(messages),
        requestBody.model,
        estimatedInputTokens
      );
      
      if (tokenTrackingInfo) {
        console.log('[TOKEN TRACKING] Initial records created with message ID:', tokenTrackingInfo.messageId);
      } else {
        console.error('[TOKEN TRACKING] Failed to create initial records');
      }
    }

    console.log('Sending request to Anthropic API with message structure:', 
      imageUrl ? 'Image + Text' : 'Text only');
    console.log('Using model:', requestBody.model);
    console.log('System message is properly set with length:', systemMessage.length);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic API error response:', errorText);
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log('Successfully got response from Anthropic API');
      
      if (requestBody.stream) {
        console.log('Returning streaming response to client');
        
        if (response.body) {
          const { readable, writable } = new TransformStream();
          
          const reader = response.body.getReader();
          const writer = writable.getWriter();
          
          EdgeRuntime.waitUntil(processAnthropicStream(
            reader, 
            writer,
            supabase,
            gameId,
            estimatedInputTokens,
            tokenTrackingInfo
          ));
          
          return new Response(readable, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        } else {
          throw new Error('Stream response body is null');
        }
      } else {
        console.log('Processing non-streaming response');
        const responseText = await response.text();
        console.log('Response length:', responseText.length);
        
        const { data: savedMessage, error: saveError } = await supabase
          .from('game_messages')
          .insert({
            game_id: gameId,
            message: message,
            response: responseText,
            image_url: imageUrl,
            is_system: false,
            model_type: modelType || 'smart'
          })
          .select('id')
          .single();
        
        if (saveError) {
          console.error('Error saving message:', saveError);
        } else {
          console.log('Saved message with ID:', savedMessage.id);
        }
        
        const { error: updateGameError } = await supabase
          .from('games')
          .update({
            code: JSON.parse(responseText).content
          })
          .eq('id', gameId);
        
        if (updateGameError) {
          console.error(`Error updating game: ${updateGameError.message}`);
        } else {
          console.log(`Updated game ${gameId} with new content`);
        }
        
        return new Response(
          JSON.stringify(JSON.parse(responseText)),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error in Anthropic API request:', error);
      throw error;
    }

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
