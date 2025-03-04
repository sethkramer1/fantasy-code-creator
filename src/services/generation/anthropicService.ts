
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
            
            // Debug log to see what's coming
            if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
              console.log("Received thinking delta:", data.delta.thinking);
            }
            
            // Handle thinking content
            if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
              const thinking = data.delta.thinking || '';
              if (thinking && thinking !== currentThinking && onThinking) {
                currentThinking = thinking;
                onThinking(thinking);
              }
            }
            // Handle text content - filter out token information
            else if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              const content = data.delta.text || '';
              if (content && onContent) {
                // Skip token information in the actual content
                if (!content.includes("Tokens used:") && 
                    !content.includes("input tokens") && 
                    !content.includes("output tokens")) {
                  combinedContent += content;
                  onContent(content);
                }
              }
            }
            // Handle token information separately
            else if (data.type === 'message_delta' && data.usage) {
              console.log("Received token usage:", data.usage);
              // Don't add this to the content, but you could call a callback if needed
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
      
      // Remove any token information that might have snuck into the content
      combinedContent = combinedContent.replace(/Tokens used:.*?(input|output).*?\n/g, '');
      combinedContent = combinedContent.replace(/\d+ input tokens, \d+ output tokens/g, '');
      
      return { gameContent: combinedContent };
    } else {
      // Handle non-streaming response
      const data = await response.json();
      let gameContent = data.content || '';
      
      // Remove token information from the actual content
      gameContent = gameContent.replace(/Tokens used:.*?(input|output).*?\n/g, '');
      gameContent = gameContent.replace(/\d+ input tokens, \d+ output tokens/g, '');
      
      // Extract token information if available
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
