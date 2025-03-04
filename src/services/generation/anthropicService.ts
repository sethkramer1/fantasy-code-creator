
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
      const decoder = new TextDecoder();
      let content = '';
      let combinedContent = '';
      let streamComplete = false;
      
      if (!reader) throw new Error('Stream reader is not available');

      while (!streamComplete) {
        const { done, value } = await reader.read();
        
        if (done) {
          streamComplete = true;
          if (onComplete) onComplete(combinedContent);
          break;
        }
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const eventData = line.slice(5).trim();
              
              if (eventData === '[DONE]') {
                streamComplete = true;
                if (onComplete) onComplete(combinedContent);
                break;
              }
              
              // Parse the JSON data
              const data = JSON.parse(eventData);
              
              // Handle thinking message
              if (data.thinking && onThinking) {
                onThinking(data.thinking);
                continue;
              }
              
              // Handle content delta
              if (data.type === 'content_block_delta' && data.delta?.text && onContent) {
                content = data.delta.text;
                combinedContent += content;
                onContent(content);
              }
              // Handle whole content block
              else if (data.type === 'content_block_start' && data.content_block?.text && onContent) {
                content = data.content_block.text;
                combinedContent += content;
                onContent(content);
              }
              // Handle error
              else if (data.type === 'error' && onError) {
                onError(new Error(data.error?.message || 'Unknown stream error'));
              }
            } catch (parseError) {
              console.error('Error parsing SSE event:', parseError, 'Line:', line);
              if (onError) onError(new Error(`Stream parsing error: ${parseError.message}`));
            }
          }
        }
      }
      
      return { gameContent: combinedContent };
    } else {
      // Handle non-streaming response
      const data = await response.json();
      const gameContent = data.content || '';
      
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
