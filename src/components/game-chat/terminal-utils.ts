export const updateTerminalOutput = (
  setTerminalOutput: React.Dispatch<React.SetStateAction<string[]>>, 
  newContent: string, 
  isNewMessage = false
) => {
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
        if (lines[i]) {
          result.push(`> ${lines[i]}`);
        }
      }
      
      // Add last segment if it exists
      if (lines.length > 1 && lines[lines.length - 1]) {
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

export const processAnthropicStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  updateTerminalOutputFn: (text: string, isNewLine?: boolean) => void
) => {
  let content = '';
  let buffer = '';
  let currentThinkingPhase = '';
  
  updateTerminalOutputFn("> Anthropic stream connected, receiving content...", true);
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log("Stream complete");
        updateTerminalOutputFn("> Stream complete", true);
        break;
      }
      
      const chunk = new TextDecoder().decode(value);
      buffer += chunk;
      
      let lineEnd;
      while ((lineEnd = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 1);
        
        if (!line.startsWith('data: ')) continue;
        
        try {
          const eventData = line.slice(5).trim();
          
          if (eventData === '[DONE]') {
            updateTerminalOutputFn("> Stream complete", true);
            break;
          }
          
          const data = JSON.parse(eventData);
          
          switch (data.type) {
            case 'message_start':
              updateTerminalOutputFn("> Starting response generation...", true);
              if (data.message?.usage) {
                updateTerminalOutputFn(`> Input tokens: ${data.message.usage.input_tokens}`, true);
              }
              break;
              
            case 'content_block_start':
              if (data.content_block?.type === 'text') {
                updateTerminalOutputFn("> Generating content...", true);
              }
              break;
              
            case 'content_block_delta':
              if (data.delta?.type === 'thinking_delta') {
                const thinking = data.delta.thinking?.trim() || '';
                if (thinking && thinking !== currentThinkingPhase) {
                  currentThinkingPhase = thinking;
                  updateTerminalOutputFn(`> Thinking: ${thinking}`, true);
                }
              } else if (data.delta?.type === 'text_delta') {
                const contentChunk = data.delta.text || '';
                if (contentChunk) {
                  content += contentChunk;
                  updateTerminalOutputFn(`> ${contentChunk}`, false);
                }
              }
              break;
              
            case 'message_delta':
              if (data.delta?.stop_reason) {
                updateTerminalOutputFn(`> Generation ${data.delta.stop_reason}`, true);
              }
              if (data.usage?.output_tokens) {
                updateTerminalOutputFn(`> Output tokens: ${data.usage.output_tokens}`, true);
              }
              break;
              
            case 'message_stop':
              updateTerminalOutputFn("> Content generation completed!", true);
              break;
              
            case 'error':
              const errorMessage = data.error?.message || 'Unknown error';
              const errorType = data.error?.type || 'generic_error';
              updateTerminalOutputFn(`> Error: ${errorMessage} (${errorType})`, true);
              console.error("Stream error:", data.error);
              throw new Error(errorMessage);
          }
        } catch (parseError) {
          if (!line.includes('[DONE]')) {
            console.error('Error parsing stream data:', parseError, 'Line:', line);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error processing stream:", error);
    updateTerminalOutputFn(`> Error processing stream: ${error.message}`, true);
    throw error;
  }
  
  if (!content || content.trim().length === 0) {
    throw new Error("No content received from AI. Please try again.");
  }
  
  return content;
};
