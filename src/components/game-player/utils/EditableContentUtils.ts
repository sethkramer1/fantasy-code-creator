/**
 * Adds the 'editable' class to text elements in HTML content
 * @param htmlContent The original HTML content
 * @returns HTML content with editable classes added to text elements
 */
export function prepareEditableContent(htmlContent: string): string {
  // If the content is empty, return it as is
  if (!htmlContent) return htmlContent;
  
  // Create a temporary DOM element to parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Find text elements that should be editable
  // This includes headings, paragraphs, spans, list items, etc.
  const textElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div:not(:has(*)), li, a, button');
  
  textElements.forEach((element) => {
    // Only make elements with text content editable
    if (element.textContent && element.textContent.trim() !== '') {
      element.classList.add('editable');
    }
  });
  
  // Return the modified HTML
  return doc.documentElement.outerHTML;
}

/**
 * Removes the 'editable' class from elements in HTML content
 * @param htmlContent The HTML content with editable classes
 * @returns HTML content with editable classes removed
 */
export function cleanEditableContent(htmlContent: string): string {
  // If the content is empty, return it as is
  if (!htmlContent) return htmlContent;
  
  // Create a temporary DOM element to parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Find elements with the 'editable' class
  const editableElements = doc.querySelectorAll('.editable');
  
  editableElements.forEach((element) => {
    element.classList.remove('editable');
    // Also remove any inline styles that might have been added during editing
    (element as HTMLElement).removeAttribute('contenteditable');
    (element as HTMLElement).style.cursor = '';
  });
  
  // Remove any edit-specific styles
  const editStyles = doc.querySelector('style[data-edit-mode="true"]');
  if (editStyles) {
    editStyles.remove();
  }
  
  // Return the modified HTML
  return doc.documentElement.outerHTML;
}

/**
 * Extracts the edited content from an iframe document
 * @param iframeDoc The iframe document containing edited content
 * @returns The cleaned HTML content with editable classes removed
 */
export function extractEditedContent(iframeDoc: Document): string {
  // Clone the document to avoid modifying the original
  const clonedDoc = iframeDoc.cloneNode(true) as Document;
  
  // Remove any edit-specific styles
  const editStyles = clonedDoc.querySelector('style[data-edit-mode="true"]');
  if (editStyles) {
    editStyles.remove();
  }
  
  // Remove contenteditable attributes and cursor styles
  const editableElements = clonedDoc.querySelectorAll('[contenteditable="true"], .editable');
  editableElements.forEach((element) => {
    (element as HTMLElement).removeAttribute('contenteditable');
    (element as HTMLElement).style.cursor = '';
    (element as HTMLElement).style.outline = '';
    (element as HTMLElement).style.padding = '';
    
    // Keep the editable class if it was originally there, but remove any styling
    // This allows for future editing sessions to identify the same elements
  });
  
  // Remove any temporary elements that might have been added during editing
  const tempElements = clonedDoc.querySelectorAll('[data-temp-edit="true"]');
  tempElements.forEach(el => el.remove());
  
  // Return the cleaned HTML
  return clonedDoc.documentElement.outerHTML;
}
