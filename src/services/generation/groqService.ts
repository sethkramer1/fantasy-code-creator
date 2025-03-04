
import { contentTypes } from "@/types/game";
import { getContentTypeInstructions } from "@/utils/contentTypeInstructions";

const GROQ_API_ENDPOINT = 'https://nvutcgbgthjeetclfibd.supabase.co/functions/v1/generate-with-groq';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52dXRjZ2JndGhqZWV0Y2xmaWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODAxMDQsImV4cCI6MjA1NjE1NjEwNH0.GO7jtRYY-PMzowCkFCc7wg9Z6UhrNUmJnV0t32RtqRo';

export interface GroqCallbacks {
  onContent: (content: string) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
  onStreamStart: () => void;
}

export interface TokenInfo {
  inputTokens?: number;
  outputTokens?: number;
}

export const callGroqApi = async (
  prompt: string,
  gameType: string,
  imageUrl?: string,
  callbacks?: GroqCallbacks
): Promise<{ response: Response, gameContent: string, tokenInfo?: TokenInfo }> => {
  let gameContent = '';
  let tokenInfo: TokenInfo = {
    inputTokens: Math.ceil(prompt.length / 4),
    outputTokens: 0
  };
  
  const selectedType = contentTypes.find(type => type.id === gameType);
  if (!selectedType) throw new Error("Invalid content type selected");

  const enhancedPrompt = selectedType.promptPrefix + " " + prompt;
  const { systemInstructions } = getContentTypeInstructions(gameType);
  
  // Combine the system instructions with the enhanced prompt and image URL
  const finalPrompt = `${systemInstructions}\n\n${enhancedPrompt}`;
  
  callbacks?.onStreamStart();
  
  const response = await fetch(
    GROQ_API_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        prompt: finalPrompt,
        imageUrl: imageUrl,
        contentType: gameType,
        stream: false // Disable streaming for Groq
      }),
      signal: AbortSignal.timeout(180000), // 3 minute timeout
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
  
  // Process non-streaming Groq response
  callbacks?.onStreamStart();
  
  const data = await response.json();
  if (data.error) {
    throw new Error(`Groq API error: ${data.error}`);
  }
  
  // Extract the content from the non-streaming response
  if (data.choices && data.choices[0] && data.choices[0].message) {
    const content = data.choices[0].message.content;
    gameContent = content;
    
    // Display content in chunks for better visibility
    const contentLines = content.split('\n');
    for (const contentLine of contentLines) {
      if (contentLine.trim()) {
        callbacks?.onContent(contentLine);
      }
    }
    
    callbacks?.onComplete();
  } else {
    throw new Error("Invalid response format from Groq API");
  }

  // Extract token usage information from the Groq response
  if (data.usage) {
    console.log("Token usage from Groq:", data.usage);
    
    // In Groq's response, prompt_tokens are the input tokens and completion_tokens are the output tokens
    tokenInfo = {
      inputTokens: data.usage.prompt_tokens || tokenInfo.inputTokens,
      outputTokens: data.usage.completion_tokens || Math.ceil(gameContent.length / 4)
    };
    
    callbacks?.onContent(`Tokens used: ${tokenInfo.inputTokens} input, ${tokenInfo.outputTokens} output`);
  }

  console.log("Final token usage for Groq:", tokenInfo);
  return { response, gameContent, tokenInfo };
};
