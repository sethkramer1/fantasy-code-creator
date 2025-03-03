
export const updateTerminalOutput = (
  setTerminalOutput: React.Dispatch<React.SetStateAction<string[]>>, 
  newContent: string, 
  isNewMessage = false
) => {
  setTerminalOutput(prev => {
    if (isNewMessage || 
        newContent.startsWith("> Thinking:") || 
        newContent.startsWith("> Generation") || 
        newContent.includes("completed") || 
        newContent.includes("Error:")) {
      return [...prev, newContent];
    }
    
    if (prev.length > 0) {
      const lastLine = prev[prev.length - 1];
      
      if (lastLine.startsWith("> ") && !lastLine.startsWith("> Thinking:") && 
          newContent.startsWith("> ") && !newContent.startsWith("> Thinking:")) {
        
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
  let totalChunks = 0;
  let buffer = '';
  let currentLineContent = '';
  
  updateTerminalOutputFn("> Anthropic stream connected, receiving content...", true);
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log("Stream complete after", totalChunks, "chunks");
        updateTerminalOutputFn("> Stream complete", true);
        break;
      }
      
      totalChunks++;
      const chunk = new TextDecoder().decode(value);
      buffer += chunk;
      
      console.log(`Received chunk #${totalChunks}, size: ${chunk.length}`);
      if (totalChunks <= 3) {
        console.log("Chunk sample:", chunk.substring(0, 100));
      }
      
      let lineEnd;
      while ((lineEnd = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 1);
        
        if (!line) continue;
        
        if (line.startsWith('data: ')) {
          try {
            const parsedData = JSON.parse(line.slice(5));
            
            if (parsedData.type === 'content_block_delta' && parsedData.delta?.type === 'text_delta') {
              const contentChunk = parsedData.delta.text || '';
              if (contentChunk) {
                content += contentChunk;
                
                if (contentChunk.includes('\n')) {
                  const lines = contentChunk.split('\n');
                  
                  if (lines[0]) {
                    currentLineContent += lines[0];
                    updateTerminalOutputFn(`> ${currentLineContent}`, false);
                  }
                  
                  for (let i = 1; i < lines.length - 1; i++) {
                    if (lines[i].trim()) {
                      currentLineContent = lines[i];
                      updateTerminalOutputFn(`> ${currentLineContent}`, true);
                    }
                  }
                  
                  if (lines.length > 1) {
                    currentLineContent = lines[lines.length - 1];
                    if (currentLineContent) {
                      updateTerminalOutputFn(`> ${currentLineContent}`, true);
                    } else {
                      currentLineContent = '';
                    }
                  }
                } else {
                  currentLineContent += contentChunk;
                  updateTerminalOutputFn(`> ${currentLineContent}`, false);
                }
              }
            } else if (parsedData.type === 'content_block_start') {
              if (parsedData.content_block?.type === 'thinking') {
                updateTerminalOutputFn("> Thinking phase started...", true);
              }
            } else if (parsedData.type === 'content_block_delta' && parsedData.delta?.type === 'thinking_delta') {
              const thinking = parsedData.delta.thinking || '';
              if (thinking && thinking.trim()) {
                updateTerminalOutputFn(`> Thinking: ${thinking}`, true);
              }
            } else if (parsedData.type === 'content_block_stop') {
              if (parsedData.content_block?.type === 'thinking') {
                updateTerminalOutputFn("> Thinking phase completed", true);
              }
            } else if (parsedData.type === 'message_delta') {
              if (parsedData.delta?.stop_reason) {
                updateTerminalOutputFn(`> Generation ${parsedData.delta.stop_reason}`, true);
              }
            } else if (parsedData.type === 'message_stop') {
              updateTerminalOutputFn("> Content generation completed!", true);
            }
          } catch (e) {
            console.warn("Error parsing Anthropic data:", e);
            console.log("Raw data that failed to parse:", line.slice(5));
            // Continue even if we can't parse a line - don't throw here
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
