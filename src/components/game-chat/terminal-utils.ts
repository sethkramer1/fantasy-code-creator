export const updateTerminalOutput = (
  setTerminalOutput: React.Dispatch<React.SetStateAction<string[]>>, 
  newContent: string, 
  isNewMessage = false
) => {
  // Skip token information completely
  if (isTokenInfo(newContent)) {
    console.log("Skipping token info from terminal:", newContent);
    return;
  }

  setTerminalOutput(prev => {
    // Special markers that should always be on a new line
    if (isNewMessage || 
        newContent.startsWith("> Thinking:") || 
        newContent.startsWith("> Generation") || 
        newContent.includes("completed") || 
        newContent.includes("Error:")) {
      return [...prev, newContent];
    }
    
    // If there are newlines in the content, split and process each line
    if (newContent.includes('\n')) {
      const lines = newContent.split('\n');
      let result = [...prev];
      
      // Process first segment - append to last line if possible
      if (prev.length > 0 && lines[0]) {
        const lastLine = prev[prev.length - 1];
        if (lastLine.startsWith("> ") && !lastLine.startsWith("> Thinking:")) {
          result[result.length - 1] = lastLine + lines[0];
        } else {
          result.push(lines[0]);
        }
      } else if (lines[0]) {
        result.push(lines[0]);
      }
      
      // Add middle segments as new lines
      for (let i = 1; i < lines.length - 1; i++) {
        if (lines[i] && !isTokenInfo(lines[i])) {
          result.push(`> ${lines[i]}`);
        }
      }
      
      // Add last segment if it exists
      if (lines.length > 1 && lines[lines.length - 1] && !isTokenInfo(lines[lines.length - 1])) {
        result.push(`> ${lines[lines.length - 1]}`);
      }
      
      return result;
    }
    
    // Handle inline updates by appending to the last line
    if (prev.length > 0) {
      const lastLine = prev[prev.length - 1];
      
      if (lastLine.startsWith("> ") && !lastLine.startsWith("> Thinking:") && 
          newContent.startsWith("> ") && !newContent.startsWith("> Thinking:")) {
        
        // Fix: Use slice(1) instead of slice(2) to properly handle prefixes
        const updatedLastLine = lastLine + newContent.slice(1);
        return [...prev.slice(0, -1), updatedLastLine];
      }
    }
    
    return [...prev, newContent];
  });
};

export const processGroqResponse = async (
  responseData: any,
  updateTerminalOutputFn: (text: string, isNewLine?: boolean) => void
) => {
  if (!responseData || !responseData.content) {
    throw new Error("No valid content in Groq response");
  }
  
  let content = responseData.content;
  updateTerminalOutputFn("> Received complete content from Groq", true);
  
  // Clean the content from token info before extraction
  content = removeTokenInfo(content);
  
  if (content.includes("```html")) {
    console.log("Found HTML code block, extracting...");
    const htmlMatch = content.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch && htmlMatch[1] && htmlMatch[1].trim().length > 0) {
      content = htmlMatch[1].trim();
      console.log("Extracted HTML from code block, length:", content.length);
      updateTerminalOutputFn("> Extracted HTML from code block", true);
    }
  }
  
  if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
    if (content.includes('<') && content.includes('>') &&
        (content.includes('<div') || content.includes('<p') || content.includes('<span'))) {
      
      updateTerminalOutputFn("> Wrapping HTML elements in document structure...", true);
      content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="content">
    ${content}
  </div>
</body>
</html>`;
    } else {
      updateTerminalOutputFn("> Converting plain text to HTML document...", true);
      content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="content">
    ${content
      .split('\n')
      .map(line => {
        if (line.trim().length === 0) return '';
        if (line.startsWith('#')) {
          const level = line.match(/^#+/)[0].length;
          const text = line.replace(/^#+\s*/, '');
          return `<h${level}>${text}</h${level}>`;
        }
        return `<p>${line}</p>`;
      })
      .join('\n')}
  </div>
</body>
</html>`;
    }
  }
  
  return content;
};

export async function processAnthropicStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  updateTerminalOutputFn: (message: string, isThinking?: boolean) => void,
  onData?: (data: any) => void,
  onComplete?: (content: string) => void
): Promise<string> {
  let content = '';
  let buffer = '';
  
  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('[STREAM] Processing timeout reached, aborting...');
      abortController.abort();
    }, 600000); // 10 minutes (600,000 ms)
    
    while (true) {
      try {
        const { done, value } = await reader.read();
        
        if (done) {
          clearTimeout(timeoutId);
          if (onComplete) onComplete(content);
          return content;
        }
        
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          
          if (!line || !line.startsWith('data: ')) continue;
          
          const rawData = line.slice(5).trim();
          
          if (rawData === '[DONE]') {
            if (onComplete) onComplete(content);
            return content;
          }
          
          try {
            const data = JSON.parse(rawData);
            
            if (onData) onData(data);
            
            switch (data.type) {
              case 'content_block_delta':
                if (data.delta?.type === 'thinking_delta') {
                  const thinking = data.delta.thinking?.trim() || '';
                  if (thinking) {
                    // Always display thinking updates, even if they're similar to previous ones
                    updateTerminalOutputFn(`> Thinking: ${thinking}`, true);
                  }
                } else if (data.delta?.type === 'text_delta') {
                  const contentChunk = data.delta.text || '';
                  if (contentChunk && !isTokenInfo(contentChunk)) {
                    // Only add non-token content
                    content += contentChunk;
                    updateTerminalOutputFn(`> ${contentChunk}`, false);
                  }
                }
                break;
                
              case 'content_block_start':
                if (data.content_block?.type === 'thinking') {
                  const thinking = data.content_block.thinking?.trim() || '';
                  if (thinking) {
                    updateTerminalOutputFn(`> Thinking: ${thinking}`, true);
                  }
                } else if (data.content_block?.text) {
                  const contentText = data.content_block.text;
                  if (contentText && !isTokenInfo(contentText)) {
                    content += contentText;
                    updateTerminalOutputFn(`> ${contentText}`, false);
                  }
                }
                break;
                
              case 'error':
                const errorMsg = data.error?.message || 'Unknown error in stream';
                updateTerminalOutputFn(`> Error: ${errorMsg}`, false);
                throw new Error(errorMsg);
            }
          } catch (parseError) {
            console.error('Error parsing JSON:', parseError, 'Line:', line);
            // Don't throw here, just log and continue
          }
        }
      } catch (readError) {
        console.error('Error reading from stream:', readError);
        updateTerminalOutputFn(`> Error reading from stream: ${readError instanceof Error ? readError.message : String(readError)}`, false);
        throw readError;
      }
    }
  } catch (streamError) {
    console.error('Stream processing error:', streamError);
    updateTerminalOutputFn(`> Stream error: ${streamError instanceof Error ? streamError.message : String(streamError)}`, false);
    
    // If we have partial content, let's return it instead of throwing
    if (content.length > 0) {
      console.log(`Returning partial content (${content.length} chars) after stream error`);
      return content;
    }
    
    throw streamError;
  }
}

// Helper functions for token detection and removal
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
  
  // Remove any residual patterns with just numbers that might be token counts
  content = content.replace(/\b\d+ input\b/g, '');
  content = content.replace(/\b\d+ output\b/g, '');
  
  return content.trim();
}
