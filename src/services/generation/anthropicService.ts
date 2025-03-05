import { StreamCallbacks } from "@/types/generation";
import { getSystemPrompt } from "./promptService";
import { buildPrompt } from "./promptBuilder";
import { supabase } from "@/integrations/supabase/client";

export const callAnthropicApi = async (
  prompt: string,
  gameType: string,
  imageUrl?: string,
  partialResponse?: string,
  callbacks = {} as StreamCallbacks
): Promise<{ gameContent: string; tokenInfo?: { inputTokens: number; outputTokens: number } }> => {
  const { onStreamStart, onThinking, onContent, onError, onComplete } = callbacks;
  
  const user = supabase.auth.getUser();
  const userId = (await user).data.user?.id;

  try {
    // For streaming requests
    const response = await fetch('/api/generate-game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: buildPrompt(prompt, gameType),
        imageUrl,
        partialResponse,
        system: getSystemPrompt(gameType),
        userId: userId, // Pass the user ID for token tracking
        stream: true,
        thinking: {
          type: "enabled",
          budget_tokens: 3500
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Generate API error:', errorText);
      
      // Provide more specific error messages based on status code and error text
      if (response.status === 429) {
        throw new Error(`Anthropic API rate limit exceeded. Please try again later.`);
      } else if (response.status === 400 && errorText.includes('token')) {
        throw new Error(`Anthropic API token limit exceeded. Try a shorter message or remove the image.`);
      } else if (response.status === 500 || response.status === 503) {
        throw new Error(`Anthropic API service unavailable. Please try again later or switch to the "fast" model.`);
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(`Anthropic API authentication error. Please contact support.`);
      } else if (response.status === 408 || errorText.includes('timeout')) {
        throw new Error(`Anthropic API request timed out. Please try again or switch to the "fast" model.`);
      } else {
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
    }

    // If we expect a streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      if (onStreamStart) onStreamStart();
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream reader is not available');
      
      let buffer = '';
      let combinedContent = '';
      let currentThinking = '';
      
      // Process the stream line by line
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          if (onComplete) onComplete(combinedContent);
          break;
        }
        
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          if (!line || !line.startsWith('data: ')) continue;
          
          try {
            const eventData = line.slice(5).trim();
            
            if (eventData === '[DONE]') {
              if (onComplete) onComplete(combinedContent);
              break;
            }
            
            const data = JSON.parse(eventData);
            
            // Handle direct thinking property (used in both initial and edit generations)
            if (data.thinking && onThinking) {
              if (data.thinking !== currentThinking) {
                currentThinking = data.thinking;
                onThinking(data.thinking);
              }
              continue;
            }
            
            // Handle thinking content from content_block_delta
            if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
              const thinking = data.delta.thinking || '';
              if (thinking && thinking !== currentThinking && onThinking) {
                currentThinking = thinking;
                onThinking(thinking);
              }
              continue;
            }
            
            // Handle text content - completely filter out token information
            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              const content = data.delta.text || '';
              if (content && onContent && !isTokenInfo(content)) {
                // Remove any token info before adding to combined content
                const cleanContent = removeTokenInfo(content);
                if (cleanContent.trim()) {
                  combinedContent += cleanContent;
                  onContent(cleanContent);
                }
              }
              continue;
            }
            
            // Handle content block start
            if (data.type === 'content_block_start' && data.content_block?.text) {
              const content = data.content_block.text || '';
              if (content && onContent && !isTokenInfo(content)) {
                const cleanContent = removeTokenInfo(content);
                if (cleanContent.trim()) {
                  combinedContent += cleanContent;
                  onContent(cleanContent);
                }
              }
              continue;
            }
            
            // Track token information internally but don't display it
            if ((data.type === 'message_delta' || data.type === 'token_usage') && data.usage) {
              console.log("Received token usage:", data.usage);
              // We're intentionally not calling onContent for token info
              continue;
            }
            
            // Handle errors
            if (data.type === 'error' && onError) {
              onError(new Error(data.error?.message || 'Unknown stream error'));
            }
          } catch (parseError) {
            console.error('Error parsing SSE event:', parseError, 'Line:', line);
            if (onError) onError(new Error(`Stream parsing error: ${parseError.message}`));
          }
        }
      }
      
      // Final cleanup - ensure all token information is removed
      combinedContent = removeTokenInfo(combinedContent);
      
      return { gameContent: combinedContent };
    } else {
      // Handle non-streaming response
      const data = await response.json();
      let gameContent = data.content || '';
      
      // Remove token information from the actual content
      gameContent = removeTokenInfo(gameContent);
      
      // Extract token information if available (for internal tracking only)
      const tokenInfo = data.usage ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      } : undefined;
      
      return { gameContent, tokenInfo };
    }
  } catch (error) {
    console.error('anthropicService API call failed:', error);
    
    // Enhance error messages for common issues
    let enhancedError = error;
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        enhancedError = new Error('Anthropic API request timed out. Please try again or switch to the "fast" model.');
      } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
        enhancedError = new Error('Network error connecting to Anthropic API. Please check your connection and try again.');
      } else if (errorMsg.includes('aborted')) {
        enhancedError = new Error('Anthropic API request was aborted. Please try again or switch to the "fast" model.');
      }
    }
    
    if (onError) onError(enhancedError instanceof Error ? enhancedError : new Error(String(enhancedError)));
    throw enhancedError;
  }
};

// Helper function to detect token information
function isTokenInfo(text: string): boolean {
  // Check for various token info patterns
  return (
    text.includes("Tokens used:") ||
    text.includes("input tokens") ||
    text.includes("output tokens") ||
    text.includes("Token usage:") ||
    /\d+\s*input\s*,\s*\d+\s*output/.test(text) || // Pattern like "264 input, 1543 output"
    /\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens/.test(text) || // Pattern like "264 input tokens, 1543 output tokens"
    /input:?\s*\d+\s*,?\s*output:?\s*\d+/.test(text) // Pattern like "input: 264, output: 1543"
  );
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
  
  return content;
}

/**
 * Generates a short, catchy name for a game design based on the initial prompt
 * using the Claude 3.5 Haiku model
 * 
 * @param prompt The initial prompt used to generate the game
 * @returns A short name for the game design
 */
export const generateGameName = async (prompt: string): Promise<string> => {
  try {
    console.log('[NAME_GEN] Generating game name from prompt:', prompt.substring(0, 100) + '...');
    
    // For testing purposes, return a hardcoded name to bypass API issues
    const testName = "Test Game Name: " + new Date().toISOString().substring(0, 19);
    console.log('[NAME_GEN] Using test name for debugging:', testName);
    return testName;
    
    /* Commented out for testing
    // Call the Supabase Edge Function directly
    console.log('[NAME_GEN] Calling Supabase Edge Function: generate-name');
    
    // Try a direct fetch to the Edge Function URL first
    try {
      console.log('[NAME_GEN] Attempting direct fetch to Edge Function');
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';
      
      const directResponse = await fetch('https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          prompt,
          model: "claude-3-5-haiku-20241022"
        })
      });
      
      console.log('[NAME_GEN] Direct fetch response status:', directResponse.status);
      if (directResponse.ok) {
        const directData = await directResponse.json();
        console.log('[NAME_GEN] Direct fetch response data:', directData);
        if (directData?.name) {
          console.log('[NAME_GEN] Successfully generated name via direct fetch:', directData.name);
          return directData.name;
        }
      } else {
        const errorText = await directResponse.text();
        console.error('[NAME_GEN] Direct fetch error:', errorText);
      }
    } catch (directError) {
      console.error('[NAME_GEN] Direct fetch failed:', directError);
    }
    
    // Fall back to using the supabase client
    console.log('[NAME_GEN] Falling back to supabase client');
    const { data, error } = await supabase.functions.invoke('generate-name', {
      body: { 
        prompt,
        model: "claude-3-5-haiku-20241022"
      }
    });

    console.log('[NAME_GEN] Supabase Edge Function response:', { data, error });

    if (error) {
      console.error('[NAME_GEN] Generate name API error:', error);
      throw new Error(`API error: ${error.message}`);
    }

    const gameName = data?.name || '';
    
    console.log('[NAME_GEN] Generated game name:', gameName);
    
    // If no name was generated, use a fallback
    if (!gameName) {
      const fallbackName = prompt.split(' ').slice(0, 3).join(' ') + '...';
      console.log('[NAME_GEN] No name was generated, using fallback:', fallbackName);
      return fallbackName;
    }
    
    return gameName;
    */
  } catch (error) {
    console.error('[NAME_GEN] Error generating game name:', error);
    // Return a fallback name based on the prompt if generation fails
    const fallbackName = prompt.split(' ').slice(0, 3).join(' ') + '...';
    console.log('[NAME_GEN] Using fallback name due to error:', fallbackName);
    return fallbackName;
  }
};
