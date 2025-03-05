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
        userId: userId,
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

    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      if (onStreamStart) onStreamStart();
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream reader is not available');
      
      let buffer = '';
      let combinedContent = '';
      let currentThinking = '';
      
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
            
            if (data.thinking && onThinking) {
              if (data.thinking !== currentThinking) {
                currentThinking = data.thinking;
                onThinking(data.thinking);
              }
              continue;
            }
            
            if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
              const thinking = data.delta.thinking || '';
              if (thinking && thinking !== currentThinking && onThinking) {
                currentThinking = thinking;
                onThinking(thinking);
              }
              continue;
            }
            
            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              const content = data.delta.text || '';
              if (content && onContent && !isTokenInfo(content)) {
                const cleanContent = removeTokenInfo(content);
                if (cleanContent.trim()) {
                  combinedContent += cleanContent;
                  onContent(cleanContent);
                }
              }
              continue;
            }
            
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
            
            if ((data.type === 'message_delta' || data.type === 'token_usage') && data.usage) {
              console.log("Received token usage:", data.usage);
              continue;
            }
            
            if (data.type === 'error' && onError) {
              onError(new Error(data.error?.message || 'Unknown stream error'));
            }
          } catch (parseError) {
            console.error('Error parsing SSE event:', parseError, 'Line:', line);
            if (onError) onError(new Error(`Stream parsing error: ${parseError.message}`));
          }
        }
      }
      
      combinedContent = removeTokenInfo(combinedContent);
      
      return { gameContent: combinedContent };
    } else {
      const data = await response.json();
      let gameContent = data.content || '';
      
      gameContent = removeTokenInfo(gameContent);
      
      const tokenInfo = data.usage ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      } : undefined;
      
      return { gameContent, tokenInfo };
    }
  } catch (error) {
    console.error('anthropicService API call failed:', error);
    
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

function isTokenInfo(text: string): boolean {
  return (
    text.includes("Tokens used:") ||
    text.includes("input tokens") ||
    text.includes("output tokens") ||
    text.includes("Token usage:") ||
    /\d+\s*input\s*,\s*\d+\s*output/.test(text) ||
    /\d+\s*input\s*tokens\s*,\s*\d+\s*output\s*tokens/.test(text) ||
    /input:?\s*\d+\s*,?\s*output:?\s*\d+/.test(text)
  );
}

function removeTokenInfo(content: string): string {
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

  return content;
}

export const generateGameName = async (prompt: string): Promise<string> => {
  try {
    console.log('[NAME_GEN] Generating game name from prompt:', prompt.substring(0, 100) + '...');
    
    console.log('[NAME_GEN] Calling Supabase Edge Function: generate-name');
    
    try {
      console.log('[NAME_GEN] Attempting direct fetch to Edge Function');
      
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
    
    if (!gameName) {
      const fallbackName = prompt.split(' ').slice(0, 3).join(' ') + '...';
      console.log('[NAME_GEN] No name was generated, using fallback:', fallbackName);
      return fallbackName;
    }
    
    return gameName;
  } catch (error) {
    console.error('[NAME_GEN] Error generating game name:', error);
    const fallbackName = prompt.split(' ').slice(0, 3).join(' ') + '...';
    console.log('[NAME_GEN] Using fallback name due to error:', fallbackName);
    return fallbackName;
  }
};
