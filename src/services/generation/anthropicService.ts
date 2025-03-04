
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
      throw new Error(`API error (${response.status}): ${errorText}`);
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
            
            // Handle thinking content
            if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
              const thinking = data.delta.thinking || '';
              if (thinking && thinking !== currentThinking && onThinking) {
                currentThinking = thinking;
                onThinking(thinking);
              }
            }
            // Handle thinking from message_delta (alternate format)
            else if (data.thinking && onThinking) {
              if (data.thinking !== currentThinking) {
                currentThinking = data.thinking;
                onThinking(data.thinking);
              }
            }
            // Handle text content - completely filter out token information
            else if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              const content = data.delta.text || '';
              if (content && onContent) {
                // Remove any token info before adding to combined content
                const cleanContent = removeTokenInfo(content);
                if (cleanContent.trim()) {
                  combinedContent += cleanContent;
                  onContent(cleanContent);
                }
              }
            }
            // Track token information internally but don't display it
            else if (data.type === 'message_delta' && data.usage) {
              console.log("Received token usage:", data.usage);
              // We're intentionally not calling onContent for token info
            }
            // Handle errors
            else if (data.type === 'error' && onError) {
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
    if (onError) onError(error instanceof Error ? error : new Error(String(error)));
    throw error;
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
