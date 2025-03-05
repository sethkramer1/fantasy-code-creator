import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Create a unique message ID for token tracking that can be retrieved later
function generateTokenTrackingMessageId(gameId: string): string {
  return `initial-generation-${gameId}-${Date.now()}`;
}

// Function to create message and token tracking records
async function createInitialTokenRecords(
  supabase: any, 
  gameId: string, 
  userId: string | undefined, 
  prompt: string, 
  modelType: string,
  estimatedInputTokens: number
) {
  try {
    console.log('[TOKEN TRACKING] Creating tracking records for gameId:', gameId);
    
    // Generate a predictable message ID for token tracking
    const messageId = generateTokenTrackingMessageId(gameId);
    
    // Create a message record
    const { data: messageData, error: messageError } = await supabase
      .from('game_messages')
      .insert({
        id: messageId,
        game_id: gameId,
        message: "Initial Generation",
        response: "Processing initial content...",
        is_system: true,
        model_type: modelType
      })
      .select('id')
      .single();
      
    if (messageError) {
      console.error('[TOKEN TRACKING] Error creating initial message:', messageError);
      return null;
    }
    
    console.log('[TOKEN TRACKING] Created message record:', messageData.id);
    
    // Create token usage record with estimated values
    const { data: tokenData, error: tokenError } = await supabase
      .from('token_usage')
      .insert({
        user_id: userId,
        game_id: gameId,
        message_id: messageData.id,
        prompt: prompt.substring(0, 5000), // Truncate long prompts
        input_tokens: estimatedInputTokens,
        output_tokens: 1, // Placeholder, will be updated later
        model_type: modelType
      })
      .select('id')
      .single();
      
    if (tokenError) {
      console.error('[TOKEN TRACKING] Error creating token record:', tokenError);
      return null;
    }
    
    console.log('[TOKEN TRACKING] Created token record:', tokenData.id);
    
    return {
      messageId: messageData.id,
      tokenRecordId: tokenData.id
    };
  } catch (error) {
    console.error('[TOKEN TRACKING] Error in createInitialTokenRecords:', error);
    return null;
  }
}

// Function to update token records with final counts
async function updateTokenRecords(
  supabase: any,
  messageId: string,
  inputTokens: number,
  outputTokens: number
) {
  try {
    console.log(`[TOKEN TRACKING] Updating token counts for message ${messageId}`);
    console.log(`[TOKEN TRACKING] Final counts - Input: ${inputTokens}, Output: ${outputTokens}`);
    
    // Find the token_usage record for this message
    const { data: tokenData, error: findError } = await supabase
      .from('token_usage')
      .select('id')
      .eq('message_id', messageId)
      .maybeSingle();
      
    if (findError) {
      console.error('[TOKEN TRACKING] Error finding token record:', findError);
      return false;
    }
    
    if (!tokenData?.id) {
      console.error('[TOKEN TRACKING] No token record found for message:', messageId);
      return false;
    }
    
    // Update the token counts
    const { error: updateError } = await supabase
      .from('token_usage')
      .update({
        input_tokens: inputTokens,
        output_tokens: outputTokens
      })
      .eq('id', tokenData.id);
      
    if (updateError) {
      console.error('[TOKEN TRACKING] Error updating token counts:', updateError);
      return false;
    }
    
    console.log('[TOKEN TRACKING] Token counts updated successfully');
    return true;
  } catch (error) {
    console.error('[TOKEN TRACKING] Error in updateTokenRecords:', error);
    return false;
  }
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
    const { 
      prompt, 
      imageUrl, 
      contentType, 
      system, 
      partialResponse, 
      model = "claude-3-7-sonnet-20250219", 
      stream = true, 
      userId, 
      gameId,
      thinking 
    } = requestData;
    
    console.log("Received request with prompt:", prompt);
    console.log("Prompt raw:", JSON.stringify(prompt));
    console.log("Prompt length:", prompt?.length || 0);
    console.log("Content type:", contentType);
    console.log("Model:", model);
    console.log("System prompt provided:", system ? "Yes" : "No");
    console.log("Image URL provided:", imageUrl ? "Yes" : "No");
    console.log("Partial response provided:", partialResponse ? "Yes" : "No");
    console.log("Stream mode:", stream ? "Enabled" : "Disabled");
    console.log("User ID:", userId || "Not provided");
    console.log("Game ID:", gameId || "Not provided");
    console.log("Thinking enabled:", thinking ? "Yes" : "No");
    
    // Initialize supabase client for token tracking
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Improved validation to reject "Loading..." or very short prompts
    if (!prompt || typeof prompt !== 'string' || prompt === "Loading..." || prompt.trim() === "" || prompt.length < 3) {
      console.error('Invalid or empty prompt received:', prompt);
      return new Response(
        JSON.stringify({ 
          error: 'Valid prompt is required, received: ' + (prompt || "null/undefined"),
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
Do not include any explanations, markdown formatting or code blocks - only return the actual code.
Do NOT include token usage information in your response.`;

    // Prepare the request body with the correct structure for Claude 3.7 Sonnet
    let requestBody: any = {
      model: model,
      max_tokens: 30000,
      stream: stream,
      system: systemMessage,
    };

    // Always enable thinking for all requests
    requestBody.thinking = {
      type: "enabled",
      budget_tokens: 8500
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
    console.log('Request body message contents:', JSON.stringify(requestBody.messages).substring(0, 500));
    console.log('Streaming mode:', stream ? 'Enabled' : 'Disabled');
    console.log('Thinking mode:', requestBody.thinking ? `Enabled (budget: ${requestBody.thinking.budget_tokens})` : 'Disabled');

    // Estimate input tokens (rough approximation)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    let tokenTrackingInfo = null;
    
    // Create initial token tracking records if gameId is provided
    if (gameId) {
      tokenTrackingInfo = await createInitialTokenRecords(
        supabase, 
        gameId, 
        userId, 
        prompt, 
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
    
    // For streaming mode, modify the stream to include a final message with token counts
    if (stream) {
      console.log('Streaming response back to client');
      
      if (response.body) {
        // Use the TransformStream API to modify the stream
        const { readable, writable } = new TransformStream();
        
        // Clone the original stream for reading
        const reader = response.body.getReader();
        const writer = writable.getWriter();
        
        // Variables to track thinking content
        let lastThinkingContent = '';

        // Process the stream in the background
        EdgeRuntime.waitUntil((async () => {
          try {
            let outputTokenCount = 0;
            let completeChunk = '';
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                // Calculate final token counts
                const finalOutputTokens = Math.max(1, Math.ceil(completeChunk.length / 4));
                console.log('[TOKEN TRACKING] Final output tokens (estimated):', finalOutputTokens);
                
                // Add a final event with token information
                if (tokenTrackingInfo) {
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
                      
                      // Handle thinking content
                      if (data.delta?.type === 'thinking_delta' && data.delta.thinking) {
                        // Update the thinking content
                        if (data.delta.thinking !== lastThinkingContent) {
                          lastThinkingContent = data.delta.thinking;
                          
                          // Forward thinking events directly without modification
                          const thinkingEvent = `data: ${JSON.stringify({
                            type: 'content_block_delta',
                            delta: {
                              type: 'thinking_delta',
                              thinking: data.delta.thinking
                            }
                          })}\n\n`;
                          
                          await writer.write(new TextEncoder().encode(thinkingEvent));
                          continue;
                        }
                      }
                      
                      // For standalone thinking updates (in older API format)
                      if (data.thinking && data.thinking !== lastThinkingContent) {
                        lastThinkingContent = data.thinking;
                        
                        // Forward as a simplified thinking event
                        const thinkingEvent = `data: ${JSON.stringify({ thinking: data.thinking })}\n\n`;
                        await writer.write(new TextEncoder().encode(thinkingEvent));
                        continue;
                      }
                      
                      // For content, filter out token information
                      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta' && data.delta.text) {
                        let contentText = data.delta.text;
                        
                        // Detect and remove token information
                        if (isTokenInfo(contentText)) {
                          // Skip this event entirely if it's only token information
                          if (isOnlyTokenInfo(contentText)) {
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
                        
                        // Forward the modified event
                        await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
                        continue;
                      }
                      
                      // For other events, just forward them as is
                      await writer.write(new TextEncoder().encode(line + '\n'));
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
      const data = await response.json();
      let content = data.content[0]?.text || '';
      
      // Remove token information from the content
      content = removeTokenInfo(content);
      
      // Extract token usage information
      const inputTokens = data.usage?.input_tokens || estimatedInputTokens;
      const outputTokens = data.usage?.output_tokens || Math.ceil(content.length / 4);
      
      console.log('Non-streaming response processed, content length:', content.length);
      console.log('Token usage information:', { inputTokens, outputTokens });
      
      // Update token tracking with actual values if available
      if (tokenTrackingInfo) {
        await updateTokenRecords(supabase, tokenTrackingInfo.messageId, inputTokens, outputTokens);
      }
      
      return new Response(
        JSON.stringify({ 
          content,
          usage: { 
            input_tokens: inputTokens,
            output_tokens: outputTokens
          } 
        }),
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

// Helper function to detect token information
function isTokenInfo(text: string): boolean {
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

// Helper function to check if text contains ONLY token information
function isOnlyTokenInfo(text: string): boolean {
  if (!text) return false;
  
  // Remove all token info patterns
  const cleaned = removeTokenInfo(text);
  
  // If nothing meaningful remains, it was only token info
  return !cleaned.trim();
}

// Helper function to remove token information from content
function removeTokenInfo(content: string): string {
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
  
  // Additional cleanup to catch any remaining patterns
  content = content.replace(/\b\d+ tokens\b/g, '');
  content = content.replace(/\btokens: \d+\b/g, '');
  content = content.replace(/\b\d+ input\b/g, '');
  content = content.replace(/\b\d+ output\b/g, '');
  
  return content;
}
