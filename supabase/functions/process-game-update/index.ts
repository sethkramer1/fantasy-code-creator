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
  
  // Check for various token info patterns
  return (
    text.includes("Tokens used:") ||
    text.includes("Token usage:") ||
    text.includes("input tokens") ||
    text.includes("output tokens") ||
    /\d+\s*input\s*,\s*\d+\s*output/.test(text) || // Pattern like "264 input, 1543 output"
    /\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens/.test(text) || // Pattern like "264 input tokens, 1543 output tokens"
    /input:?\s*\d+\s*,?\s*output:?\s*\d+/.test(text) || // Pattern like "input: 264, output: 1543"
    /\b(input|output)\b.*?\b\d+\b/.test(text) // Pattern with "input" or "output" followed by numbers
  );
}

function removeTokenInfo(content) {
  if (!content) return content;
  
  // Remove full lines containing token information
  content = content.replace(/Tokens used:.*?(input|output).*?\n/g, '');
  content = content.replace(/Token usage:.*?(input|output).*?\n/g, '');
  content = content.replace(/.*?\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens.*?\n/g, '');
  content = content.replace(/.*?\d+\s*input\s*,\s*\d+\s*output.*?\n/g, '');
  content = content.replace(/.*?input:?\s*\d+\s*,?\s*output:?\s*\d+.*?\n/g, '');
  
  // Remove inline token information (without newlines)
  content = content.replace(/Tokens used:.*?(input|output).*?(?=\s)/g, '');
  content = content.replace(/Token usage:.*?(input|output).*?(?=\s)/g, '');
  content = content.replace(/\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens/g, '');
  content = content.replace(/\d+\s*input\s*,\s*\d+\s*output/g, '');
  content = content.replace(/input:?\s*\d+\s*,?\s*output:?\s*\d+/g, '');
  
  // Clean up any remaining token information that might be in different formats
  content = content.replace(/input tokens:.*?output tokens:.*?(?=\s)/g, '');
  content = content.replace(/input:.*?output:.*?(?=\s)/g, '');
  content = content.replace(/\b\d+ tokens\b/g, '');
  content = content.replace(/\btokens: \d+\b/g, '');
  
  // Remove any residual patterns with just numbers that might be token counts
  content = content.replace(/\b\d+ input\b/g, '');
  content = content.replace(/\b\d+ output\b/g, '');
  
  return content.trim();
}

// Function to generate a unique message ID for token tracking
function generateTokenTrackingMessageId(gameId: string): string {
  return `token-tracking-${gameId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// Function to create initial token tracking records
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
    
    // Create a message ID for tracking
    const messageId = generateTokenTrackingMessageId(gameId);
    console.log(`[TOKEN TRACKING] Creating initial token records for game ${gameId}, model ${modelType}`);
    console.log(`[TOKEN TRACKING] Estimated input tokens: ${estimatedInputTokens}`);
    
    // Create a token usage record with estimated values
    const { data: tokenData, error: tokenError } = await supabase
      .from('token_usage')
      .insert({
        user_id: userId,
        game_id: gameId,
        message_id: messageId,
        prompt: prompt.substring(0, 5000), // Limit prompt size
        input_tokens: estimatedInputTokens,
        output_tokens: 1, // Placeholder until we get actual output
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

// Function to update token tracking records with actual values
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

DO NOT include any token information in your response. Do not add comments about token usage or any metrics.

Follow these structure requirements precisely and generate clean, semantic, and accessible code.`;

    let requestBody: any = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 30000,
      stream: stream,
      system: systemMessage,
      thinking: {
        type: "enabled",
        budget_tokens: 4000
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

    console.log('Streaming mode:', stream ? 'Enabled' : 'Disabled');
    console.log('Thinking mode:', requestBody.thinking ? `Enabled (budget: ${requestBody.thinking.budget_tokens})` : 'Disabled');

    // Estimate input tokens (rough approximation)
    const estimatedInputTokens = Math.ceil(fullPrompt.length / 4);
    let tokenTrackingInfo = null;
    
    // Create initial token tracking records if gameId is provided
    if (gameId) {
      tokenTrackingInfo = await createInitialTokenRecords(
        supabase, 
        gameId, 
        userId, 
        fullPrompt, 
        requestBody.model,
        estimatedInputTokens
      );
      
      if (tokenTrackingInfo) {
        console.log('[TOKEN TRACKING] Initial records created with message ID:', tokenTrackingInfo.messageId);
      } else {
        console.error('[TOKEN TRACKING] Failed to create initial records');
      }
    }

    // Make the request to Anthropic
    console.log('Sending request to Anthropic API with message structure:', 
      imageUrl ? 'Image + Text' : 'Text only');
    console.log('Using model:', requestBody.model);
    console.log('System message is properly set with length:', systemMessage.length);

    // Add a timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
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
      
      // For streaming responses, ensure we set the correct headers
      if (requestBody.stream) {
        console.log('Returning streaming response to client');
        
        if (response.body) {
          // Use the TransformStream API to modify the stream
          const { readable, writable } = new TransformStream();
          
          // Clone the original stream for reading
          const reader = response.body.getReader();
          const writer = writable.getWriter();
          
          // Process the stream in the background
          // @ts-ignore - EdgeRuntime is available in Deno Deploy
          EdgeRuntime.waitUntil((async () => {
            try {
              let fullContent = '';
              let completeChunk = '';
              
              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  // Calculate final token counts
                  const finalOutputTokens = Math.max(1, Math.ceil(completeChunk.length / 4));
                  console.log('[TOKEN TRACKING] Final output tokens (estimated):', finalOutputTokens);
                  
                  // Add a final event with token information
                  if (tokenTrackingInfo && tokenTrackingInfo.messageId) {
                    // Update token tracking with final values
                    await updateTokenRecords(
                      supabase,
                      tokenTrackingInfo.messageId,
                      estimatedInputTokens,
                      finalOutputTokens
                    );
                    
                    // Add the token info to the stream for internal tracking only, not display
                    const tokenInfoEvent = `data: ${JSON.stringify({
                      type: 'token_usage',
                      usage: {
                        input_tokens: estimatedInputTokens,
                        output_tokens: finalOutputTokens
                      }
                    })}\n\n`;
                    
                    await writer.write(new TextEncoder().encode(tokenInfoEvent));
                  }
                  
                  // Send the [DONE] event
                  await writer.write(new TextEncoder().encode('data: [DONE]\n\n'));
                  await writer.close();
                  
                  // Update the game version with the collected content
                  if (fullContent && gameId) {
                    try {
                      // Clean the content
                      fullContent = removeTokenInfo(fullContent);
                      
                      // Get the current version number
                      const { data: currentVersion } = await supabase
                        .from('game_versions')
                        .select('version_number')
                        .eq('game_id', gameId)
                        .order('version_number', { ascending: false })
                        .limit(1)
                        .single();
                      
                      const newVersionNumber = currentVersion ? currentVersion.version_number + 1 : 1;
                      
                      // Create a new version with the generated content
                      const { error: newVersionError } = await supabase
                        .from('game_versions')
                        .insert([{
                          game_id: gameId,
                          code: fullContent,
                          version_number: newVersionNumber,
                          instructions: "Generated with Anthropic model (streaming)"
                        }]);
                      
                      if (newVersionError) {
                        console.error(`Error creating new version: ${newVersionError.message}`);
                      } else {
                        console.log(`Created new game version ${newVersionNumber} for game ${gameId} from stream`);
                        
                        // Update the game with the latest version
                        const { error: updateGameError } = await supabase
                          .from('games')
                          .update({
                            code: fullContent,
                            current_version: newVersionNumber
                          })
                          .eq('id', gameId);
                        
                        if (updateGameError) {
                          console.error(`Error updating game: ${updateGameError.message}`);
                        } else {
                          console.log(`Updated game ${gameId} with new version ${newVersionNumber} from stream`);
                        }
                      }
                    } catch (versionError) {
                      console.error('Error updating game version from stream:', versionError);
                    }
                  }
                  
                  break;
                }
                
                // Decode the chunk
                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const eventData = line.slice(5).trim();
                      
                      if (eventData === '[DONE]') {
                        await writer.write(new TextEncoder().encode(line + '\n'));
                        continue;
                      }
                      
                      // For JSON data, we need to parse it
                      if (eventData.startsWith('{')) {
                        const data = JSON.parse(eventData);
                        
                        // For content, filter out token information
                        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta' && data.delta.text) {
                          let contentText = data.delta.text;
                          
                          // Detect and remove token information
                          if (isTokenInfo(contentText)) {
                            // Skip this event entirely if it's only token information
                            if (contentText.trim().length === 0) {
                              continue;
                            }
                            
                            // Otherwise, clean the content
                            contentText = removeTokenInfo(contentText);
                            if (!contentText.trim()) {
                              continue;
                            }
                            
                            // Update the object before sending
                            data.delta.text = contentText;
                          }
                          
                          // Add to complete content for token counting
                          completeChunk += contentText;
                          fullContent += contentText;
                        }
                        
                        // Forward the event
                        await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
                      } else {
                        // For non-JSON data, just forward it
                        await writer.write(new TextEncoder().encode(line + '\n'));
                      }
                    } catch (parseError) {
                      console.error('Error parsing stream event:', parseError);
                      // Forward the original line if we fail to parse it
                      await writer.write(new TextEncoder().encode(line + '\n'));
                    }
                  } else if (line.trim()) {
                    // Forward non-data lines
                    await writer.write(new TextEncoder().encode(line + '\n'));
                  }
                }
              }
            } catch (streamError) {
              console.error('[STREAM ERROR]', streamError);
              writer.abort(streamError);
            }
          })());
          
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
        // ... existing code for non-streaming response ...
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
