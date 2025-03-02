
/**
 * Parses HTML, CSS, and JavaScript sections from a single code string
 */
export function parseCodeSections(code: string = "") {
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
