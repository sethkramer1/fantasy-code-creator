
/**
 * Helper function to remove token usage information that might be in the code
 */
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
  content = content.replace(/\b\d+ tokens\b/g, '');
  content = content.replace(/\btokens: \d+\b/g, '');
  
  return content.trim();
}

/**
 * Parses HTML, CSS, and JavaScript sections from a single code string
 */
export function parseCodeSections(code: string = "") {
  // Clean the code of any token information before parsing
  code = removeTokenInfo(code);
  
  const htmlParts: string[] = [];
  const cssParts: string[] = [];
  const jsParts: string[] = [];
  
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(code)) !== null) {
    cssParts.push(styleMatch[1]);
  }
  
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(code)) !== null) {
    jsParts.push(scriptMatch[1]);
  }
  
  let htmlContent = code
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .trim();
  
  htmlParts.push(htmlContent);
  
  return {
    html: htmlParts.join('\n\n'),
    css: cssParts.join('\n\n'),
    js: jsParts.join('\n\n')
  };
}
