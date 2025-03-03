
import { ModelType } from "@/types/generation";
import { contentTypes } from "@/types/game";
import { getContentTypeInstructions } from "@/utils/contentTypeInstructions";

const ANTHROPIC_API_ENDPOINT = 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-game';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo';

export interface AnthropicStreamCallbacks {
  onThinking: (thinking: string) => void;
  onContent: (content: string) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
  onStreamStart: () => void;
}

export const callAnthropicApi = async (
  prompt: string,
  gameType: string,
  imageUrl?: string,
  partialResponse?: string,
  callbacks?: AnthropicStreamCallbacks
): Promise<{ response: Response, gameContent: string }> => {
  let gameContent = '';
  
  if (!prompt || prompt === "Loading...") {
    const error = new Error("Invalid or empty prompt provided: " + prompt);
    console.error(error);
    if (callbacks?.onError) {
      callbacks.onError(error);
    }
    throw error;
  }
  
  const selectedType = contentTypes.find(type => type.id === gameType);
  if (!selectedType) throw new Error("Invalid content type selected");

  // Enhanced prompt formatting
  const enhancedPrompt = selectedType.promptPrefix + " " + prompt;
  const { systemInstructions } = getContentTypeInstructions(gameType);
  
  // Combine the system instructions with the enhanced prompt
  const finalPrompt = `${enhancedPrompt}\n\n${partialResponse ? "Use this as a starting point: " + partialResponse : ""}`;
  
  if (callbacks?.onStreamStart) {
    callbacks.onStreamStart();
  }

  console.log("Calling Anthropic API with:", {
    prompt: finalPrompt,
    originalPrompt: prompt,
    promptLength: finalPrompt.length,
    systemLength: systemInstructions.length,
    hasImage: !!imageUrl
  });
  
  const response = await fetch(
    ANTHROPIC_API_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        prompt: finalPrompt,
        system: systemInstructions,
        imageUrl: imageUrl,
        contentType: gameType,
        partialResponse: partialResponse,
        model: "claude-3-7-sonnet-20250219",
        stream: true
      }),
      signal: AbortSignal.timeout(300000), // 5 minute timeout for Anthropic
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorJson.error || errorJson.message || 'Unknown error'}`);
    } catch (e) {
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText.substring(0, 100)}...`);
    }
  }

  // If callbacks are provided, process the stream
  if (callbacks && response.body) {
    const reader = response.body.getReader();
    let buffer = '';
    let combinedResponse = partialResponse || '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and add it to our buffer
        const text = new TextDecoder().decode(value);
        buffer += text;
        
        // Process complete lines from the buffer
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          // Skip empty lines
          if (!line) continue;
          
          // Handle Anthropic streaming format
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(5));

              switch (data.type) {
                case 'message_start':
                  console.log("Stream started, model:", data.message?.model || "unknown");
                  break;

                case 'content_block_start':
                  if (data.content_block?.type === 'thinking') {
                    callbacks.onThinking("\nThinking phase started...");
                  }
                  break;

                case 'content_block_delta':
                  if (data.delta?.type === 'thinking_delta') {
                    const thinking = data.delta.thinking || '';
                    if (thinking && thinking.trim()) {
                      callbacks.onThinking(thinking);
                    }
                  } else if (data.delta?.type === 'text_delta') {
                    const content = data.delta.text || '';
                    if (content) {
                      gameContent += content;
                      combinedResponse += content;
                      callbacks.onContent(content);
                    }
                  }
                  break;

                case 'content_block_stop':
                  if (data.content_block?.type === 'thinking') {
                    callbacks.onThinking("Thinking phase completed");
                  }
                  break;

                case 'message_delta':
                  if (data.delta?.stop_reason) {
                    callbacks.onThinking(`Generation ${data.delta.stop_reason}`);
                  }
                  break;

                case 'message_stop':
                  callbacks.onThinking("Game generation completed!");
                  callbacks.onComplete();
                  break;

                case 'error':
                  throw new Error(data.error?.message || 'Unknown error in stream');
              }
            } catch (e) {
              console.error('Error parsing SSE line:', e);
              console.log('Raw data that failed to parse:', line.slice(5));
              callbacks.onThinking(`Warning: Error parsing stream data: ${e instanceof Error ? e.message : 'Unknown error'}`);
              // Continue even if we can't parse a line - don't throw here
            }
          }
        }
      }
    } catch (e) {
      callbacks.onError(e instanceof Error ? e : new Error(String(e)));
      reader.releaseLock();
    }
  }

  return { response, gameContent };
};
