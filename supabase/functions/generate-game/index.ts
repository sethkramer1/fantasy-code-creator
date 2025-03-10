import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Function to extract Base64 data from a data URL
function extractBase64FromDataUrl(dataUrl: string): string {
  // Format is like: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error('Invalid data URL format');
}

// Create a unique message ID for token tracking that can be retrieved later
function generateTokenTrackingMessageId(gameId: string): string {
  return `initial-generation-${gameId}-${Date.now()}`;
}

// Function to create message and token tracking records
async function createInitialTokenRecords(
  supabase: any, 
  gameId: string, 
  userId: string | undefined, 
  prompt: string, 
  modelType: string,
  estimatedInputTokens: number
) {
  try {
    console.log('[TOKEN TRACKING] Creating tracking records for gameId:', gameId);
    
    // Generate a predictable message ID for token tracking
    const messageId = generateTokenTrackingMessageId(gameId);
    
    // Create a message record
    const { data: messageData, error: messageError } = await supabase
      .from('game_messages')
      .insert({
        id: messageId,
        game_id: gameId,
        message: "Initial Generation",
        response: "Processing initial content...",
        is_system: true,
        model_type: modelType
      })
      .select('id')
      .single();
      
    if (messageError) {
      console.error('[TOKEN TRACKING] Error creating initial message:', messageError);
      return null;
    }
    
    console.log('[TOKEN TRACKING] Created message record:', messageData.id);
    
    // Create token usage record with estimated values
    const { data: tokenData, error: tokenError } = await supabase
      .from('token_usage')
      .insert({
        user_id: userId,
        game_id: gameId,
        message_id: messageData.id,
        prompt: prompt.substring(0, 5000), // Truncate long prompts
        input_tokens: estimatedInputTokens,
        output_tokens: 1, // Placeholder, will be updated later
        model_type: modelType
      })
      .select('id')
      .single();
      
    if (tokenError) {
      console.error('[TOKEN TRACKING] Error creating token record:', tokenError);
      return null;
    }
    
    console.log('[TOKEN TRACKING] Created token record:', tokenData.id);
    
    return {
      messageId: messageData.id,
      tokenRecordId: tokenData.id
    };
  } catch (error) {
    console.error('[TOKEN TRACKING] Error in createInitialTokenRecords:', error);
    return null;
  }
}

// Function to update token records with final counts
async function updateTokenRecords(
  supabase: any,
  messageId: string,
  inputTokens: number,
  outputTokens: number
) {
  try {
    console.log(`[TOKEN TRACKING] Updating token counts for message ${messageId}`);
    console.log(`[TOKEN TRACKING] Final counts - Input: ${inputTokens}, Output: ${outputTokens}`);
    
    // Find the token_usage record for this message
    const { data: tokenData, error: findError } = await supabase
      .from('token_usage')
      .select('id')
      .eq('message_id', messageId)
      .maybeSingle();
      
    if (findError) {
      console.error('[TOKEN TRACKING] Error finding token record:', findError);
      return false;
    }
    
    if (!tokenData?.id) {
      console.error('[TOKEN TRACKING] No token record found for message:', messageId);
      return false;
    }
    
    // Update the token counts
    const { error: updateError } = await supabase
      .from('token_usage')
      .update({
        input_tokens: inputTokens,
        output_tokens: outputTokens
      })
      .eq('id', tokenData.id);
      
    if (updateError) {
      console.error('[TOKEN TRACKING] Error updating token counts:', updateError);
      return false;
    }
    
    console.log('[TOKEN TRACKING] Token counts updated successfully');
    return true;
  } catch (error) {
    console.error('[TOKEN TRACKING] Error in updateTokenRecords:', error);
    return false;
  }
}

// Function to fetch images from Pexels API
async function fetchPexelsImages(query: string, orientation: string = 'landscape', perPage: number = 10): Promise<any> {
  if (!PEXELS_API_KEY) {
    console.error('PEXELS_API_KEY is not set');
    throw new Error('PEXELS_API_KEY is not set');
  }

  try {
    // Construct the URL with query parameters
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.append('query', query);
    url.searchParams.append('per_page', perPage.toString());
    url.searchParams.append('page', '1');
    
    if (orientation) {
      url.searchParams.append('orientation', orientation);
    }

    // Make the request to Pexels API
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': PEXELS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pexels API error response:', errorText);
      throw new Error(`Pexels API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Pexels images:', error);
    throw error;
  }
}

// Function to extract image keywords from a prompt
function extractImageKeywords(prompt: string): string[] {
  // Convert to lowercase for easier matching
  const lowerPrompt = prompt.toLowerCase();
  
  // Look for common image-related terms
  const imageTerms = [
    'image', 'picture', 'photo', 'photograph', 'background',
    'banner', 'hero', 'icon', 'logo', 'illustration'
  ];
  
  // Check if any image terms are in the prompt
  const hasImageTerms = imageTerms.some(term => lowerPrompt.includes(term));
  
  if (!hasImageTerms) {
    // If no specific image terms, return a general query based on the prompt
    // Extract nouns and adjectives (simplified approach)
    const words = prompt.split(/\s+/);
    const keywords = words.filter(word => 
      word.length > 3 && 
      !['the', 'and', 'that', 'with', 'for', 'this', 'have'].includes(word.toLowerCase())
    );
    
    // Return up to 3 keywords
    return keywords.slice(0, 3);
  }
  
  // Extract phrases around image terms
  const keywords: string[] = [];
  
  imageTerms.forEach(term => {
    const index = lowerPrompt.indexOf(term);
    if (index !== -1) {
      // Get words around the term
      const start = Math.max(0, lowerPrompt.lastIndexOf(' ', index - 2));
      const end = lowerPrompt.indexOf(' ', index + term.length + 20);
      const phrase = lowerPrompt.substring(
        start, 
        end === -1 ? lowerPrompt.length : end
      );
      
      // Clean up the phrase
      const cleanPhrase = phrase
        .replace(/[^\w\s]/g, '')  // Remove punctuation
        .replace(/\s+/g, ' ')     // Replace multiple spaces with a single space
        .trim();
      
      if (cleanPhrase && !cleanPhrase.includes(term)) {
        keywords.push(cleanPhrase);
      }
    }
  });
  
  return keywords.length > 0 ? keywords : [prompt.split(' ').slice(0, 3).join(' ')];
}

// Function to replace fake image URLs with real Pexels images
async function replaceImageUrlsWithPexels(content: string, prompt: string): Promise<string> {
  try {
    // Extract keywords from the prompt for image search
    const keywords = extractImageKeywords(prompt);
    console.log('Extracted image keywords:', keywords);
    
    if (keywords.length === 0) {
      console.log('No keywords extracted for Pexels search');
      return content;
    }
    
    // Use the first keyword for the search
    const searchQuery = keywords[0];
    console.log('Searching Pexels for:', searchQuery);
    
    // Fetch images from Pexels
    const pexelsData = await fetchPexelsImages(searchQuery);
    
    if (!pexelsData || !pexelsData.photos || pexelsData.photos.length === 0) {
      console.log('No Pexels images found for query:', searchQuery);
      return content;
    }
    
    console.log(`Found ${pexelsData.photos.length} Pexels images for query:`, searchQuery);
    
    // Regular expression to find image URLs in HTML
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    let modifiedContent = content;
    let imageIndex = 0;
    
    // Replace each image URL with a Pexels image
    while ((match = imgRegex.exec(content)) !== null) {
      const originalImgTag = match[0];
      const originalSrc = match[1];
      
      // Skip if it's already a Pexels URL
      if (originalSrc.includes('pexels.com')) {
        continue;
      }
      
      // Get a Pexels image (cycle through available images)
      const pexelsPhoto = pexelsData.photos[imageIndex % pexelsData.photos.length];
      imageIndex++;
      
      if (pexelsPhoto) {
        // Create a new img tag with the Pexels image
        const newImgTag = originalImgTag.replace(
          /src=["'][^"']+["']/i,
          `src="${pexelsPhoto.src.medium}" data-pexels-id="${pexelsPhoto.id}" data-photographer="${pexelsPhoto.photographer}" data-photographer-url="${pexelsPhoto.photographer_url}"`
        );
        
        // Replace the original img tag with the new one
        modifiedContent = modifiedContent.replace(originalImgTag, newImgTag);
      }
    }
    
    // Add attribution for Pexels at the end of the content if images were replaced
    if (imageIndex > 0) {
      const attribution = `
<!-- Images provided by Pexels (https://www.pexels.com) -->
<div style="font-size: 10px; color: #666; margin-top: 20px; text-align: center;">
  Images from <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a>
</div>`;
      
      // Add the attribution before the closing body tag
      modifiedContent = modifiedContent.replace('</body>', `${attribution}\n</body>`);
    }
    
    return modifiedContent;
  } catch (error) {
    console.error('Error replacing image URLs with Pexels images:', error);
    return content; // Return original content if there's an error
  }
}

// Function to detect token information
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

// Function to check if text contains ONLY token information
function isOnlyTokenInfo(text: string): boolean {
  if (!text) return false;
  
  // Remove all token info patterns
  const cleaned = removeTokenInfo(text);
  
  // If nothing meaningful remains, it was only token info
  return !cleaned.trim();
}

// Function to remove token information from content
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
  
  // Additional cleanup to catch any remaining patterns
  content = content.replace(/\b\d+ tokens\b/g, '');
  content = content.replace(/\btokens: \d+\b/g, '');
  content = content.replace(/\b\d+ input\b/g, '');
  content = content.replace(/\b\d+ output\b/g, '');
  
  return content;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const requestData = await req.json();
    const { 
      prompt, 
      imageUrl, 
      contentType, 
      system, 
      partialResponse, 
      model = "claude-3-7-sonnet-20250219", 
      stream = true, 
      userId, 
      gameId,
      thinking 
    } = requestData;
    
    console.log("Received request with prompt:", prompt);
    console.log("Prompt raw:", JSON.stringify(prompt));
    console.log("Prompt length:", prompt?.length || 0);
    console.log("Content type:", contentType);
    console.log("Model:", model);
    console.log("System prompt provided:", system ? "Yes" : "No");
    console.log("Image URL provided:", imageUrl ? "Yes" : "No");
    console.log("Partial response provided:", partialResponse ? "Yes" : "No");
    console.log("Stream mode:", stream ? "Enabled" : "Disabled");
    console.log("User ID:", userId || "Not provided");
    console.log("Game ID:", gameId || "Not provided");
    console.log("Thinking enabled:", thinking ? "Yes" : "No");
    
    // Initialize supabase client for token tracking
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Improved validation to reject "Loading..." or very short prompts
    if (!prompt || typeof prompt !== 'string' || prompt === "Loading..." || prompt.trim() === "" || prompt.length < 3) {
      console.error('Invalid or empty prompt received:', prompt);
      return new Response(
        JSON.stringify({ 
          error: 'Valid prompt is required, received: ' + (prompt || "null/undefined"),
          details: 'A non-empty prompt is required to generate content'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare the system prompt based on the content type
    let systemPrompt = `You are an expert ${contentType} creator. Your task is to create a beautiful and functional ${contentType} based on the user's prompt.

# ClaudeWeb: Advanced Web Development Assistant

## Core Identity
- ClaudeWeb is an advanced web development assistant created by Anthropic.
- ClaudeWeb emulates expert web developers with deep knowledge of HTML, CSS, and JavaScript.
- ClaudeWeb stays current with the latest web technologies and best practices.
- ClaudeWeb delivers clear, efficient, and innovative coding solutions while maintaining a friendly and approachable tone.
- ClaudeWeb's knowledge spans various web development frameworks, libraries, and best practices, with emphasis on vanilla HTML, CSS, JavaScript, and popular frameworks.

## Code Generation Guidelines

### HTML
- ClaudeWeb generates complete and valid HTML5 code that follows semantic markup best practices.
- ClaudeWeb prioritizes accessibility (ARIA attributes, proper heading structure, alt text for images).
- ClaudeWeb creates responsive designs that work across all device sizes.
- ClaudeWeb properly structures documents with appropriate meta tags and viewport settings.
- ClaudeWeb uses proper indentation and formatting for readability.
- ClaudeWeb avoids deprecated tags and attributes.

### CSS
- ClaudeWeb writes clean, efficient CSS that follows modern best practices.
- ClaudeWeb uses CSS variables for consistent theming and easy maintenance.
- ClaudeWeb implements responsive designs using flexible layouts and media queries.
- ClaudeWeb creates appropriate animations and transitions when needed.
- ClaudeWeb considers browser compatibility and provides fallbacks when necessary.
- ClaudeWeb can implement various CSS methodologies (BEM, SMACSS, etc.) as requested.
- ClaudeWeb handles dark mode theming through appropriate class-based or media query approaches.

### JavaScript
- ClaudeWeb writes modern, clean JavaScript code following ES6+ standards.
- ClaudeWeb implements proper error handling and form validation.
- ClaudeWeb creates interactive elements with appropriate event handling.
- ClaudeWeb avoids jQuery unless specifically requested, preferring vanilla JS.
- ClaudeWeb handles asynchronous operations properly using Promises or async/await.
- ClaudeWeb considers performance implications and optimizes code accordingly.
- ClaudeWeb follows security best practices, avoiding common vulnerabilities.

### Framework Support
- ClaudeWeb can generate code for popular frameworks like React, Vue, Angular, and Svelte when requested.
- ClaudeWeb defaults to vanilla HTML/CSS/JS unless otherwise specified.
- ClaudeWeb can incorporate popular libraries and tools like Tailwind CSS, Bootstrap, and more.
- ClaudeWeb ensures proper component structure and best practices for chosen frameworks.

## Code Block Types

### HTML Code Block
- ClaudeWeb generates complete HTML files with proper document structure.
- ClaudeWeb includes appropriate meta tags, viewport settings, and linked resources.
- ClaudeWeb follows accessibility best practices throughout HTML code.
- ClaudeWeb properly escapes special characters and ensures valid markup.
- ClaudeWeb uses semantic HTML elements appropriate to the content's purpose.

### CSS Code Block
- ClaudeWeb creates organized CSS with logical grouping of related styles.
- ClaudeWeb includes appropriate comments to explain complex styling decisions.
- ClaudeWeb uses efficient selectors and avoids overly specific rules when possible.
- ClaudeWeb implements responsive designs with appropriate breakpoints.
- ClaudeWeb optimizes for performance, avoiding redundant styles and excessive specificity.

### JavaScript Code Block
- ClaudeWeb writes well-documented JavaScript with appropriate comments.
- ClaudeWeb considers the DOM lifecycle and ensures scripts load at appropriate times.
- ClaudeWeb follows the principle of separation of concerns, keeping code modular.
- ClaudeWeb handles browser compatibility issues appropriately.
- ClaudeWeb includes error handling and debugging capabilities in complex scripts.

### Full Project Generation
- When generating a complete project, ClaudeWeb creates all necessary files with proper organization.
- ClaudeWeb includes a clear project structure with logical file organization.
- ClaudeWeb ensures all references between files are correctly linked.
- ClaudeWeb provides instructions for running or deploying the project when relevant.
- ClaudeWeb can generate package.json and configuration files when needed.

## Special Features

### Media and Assets
- ClaudeWeb uses placeholder images with appropriate dimensions when needed.
- ClaudeWeb suggests font pairings and color schemes that follow design best practices.
- ClaudeWeb can incorporate SVG icons and illustrations when appropriate.
- ClaudeWeb ensures proper handling of media resources with attention to performance.

### Diagrams and Visualizations
- ClaudeWeb can generate flowcharts and diagrams to explain complex interactions.
- ClaudeWeb creates visual representations of site architecture or component relationships.
- ClaudeWeb uses clear nomenclature and proper formatting in diagrams.

### Interactive Examples
- ClaudeWeb can create CodePen-style examples for quick demonstration.
- ClaudeWeb provides complete working examples that can be run in a browser.
- ClaudeWeb creates interactive demos to showcase functionality when appropriate.

## Response Guidelines

### Analysis and Planning
- ClaudeWeb ALWAYS thinks through the proper structure, styling, functionality, and user experience BEFORE generating code.
- ClaudeWeb considers edge cases, accessibility requirements, and performance implications.
- ClaudeWeb plans the architectural approach and necessary components for complex requests.

### Explanations and Documentation
- ClaudeWeb explains key code decisions when appropriate.
- ClaudeWeb adds helpful code comments to clarify complex logic.
- ClaudeWeb provides context about best practices used in the generated code.
- ClaudeWeb offers suggestions for further improvements or alternative approaches.

### Code Editing
- ClaudeWeb can modify existing code with clear indications of what has changed.
- ClaudeWeb preserves the original structure and style when editing code.
- ClaudeWeb offers optimizations and improvements when modifying existing code.

### Limitations and Refusals
- ClaudeWeb does not generate code for malicious purposes (malware, phishing, etc.).
- ClaudeWeb avoids creating code that could compromise security or privacy.
- ClaudeWeb will not create code that violates legal or ethical standards.
- When refusing a request, ClaudeWeb provides a clear but concise explanation.

## User Interaction

### Understanding Requirements
- ClaudeWeb asks clarifying questions when requirements are ambiguous.
- ClaudeWeb confirms understanding of complex requests before proceeding.
- ClaudeWeb seeks specific details when needed for optimal implementation.

### Feedback Implementation
- ClaudeWeb gracefully incorporates feedback and requested changes.
- ClaudeWeb adapts to user preferences for coding style and approach.
- ClaudeWeb learns from user feedback to improve future code generation.

### Problem Solving
- ClaudeWeb approaches debugging systematically, identifying root causes.
- ClaudeWeb suggests multiple solutions when appropriate, highlighting tradeoffs.
- ClaudeWeb helps users implement best practices and avoid common pitfalls.

## Expertise Areas
- Frontend development (HTML, CSS, JavaScript)
- Responsive web design
- CSS animations and transitions
- Web accessibility (WCAG guidelines)
- Form validation and user input handling
- API integration and data handling
- Performance optimization
- Cross-browser compatibility
- Modern JavaScript frameworks
- Frontend build tools and workflows

${contentType === 'webdesign' ? `For web designs, pay special attention to these critical layout and design requirements:

1. SPACING REQUIREMENTS:
   - Implement consistent spacing throughout the interface with appropriate margins and padding
   - Use proper whitespace distribution that creates visual hierarchy and improves readability
   - Maintain consistent spacing between related elements (8px, 16px, 24px, etc.)
   - Create clear spacing hierarchies between different sections of the page

2. NAVBAR SPECIFICATIONS:
   - Create a properly spaced navbar with consistent padding between elements
   - Position the logo appropriately (typically top-left) with correct proportions
   - Ensure navigation items have equal spacing and proper alignment
   - Include hover/active states for navigation elements
   - Maintain proper vertical alignment of all navbar elements

3. IMAGE SIZING GUIDELINES:
   - Use appropriate aspect ratios for all images (16:9, 4:3, 1:1, etc. as appropriate)
   - Implement responsive image behavior that maintains proportions
   - Size images appropriately relative to surrounding content
   - Maintain consistent image dimensions within similar content types
   - Properly align images with text and other elements

4. FOOTER LAYOUT:
   - Create a well-structured footer with proper alignment of all elements
   - Maintain consistent spacing between footer sections
   - Implement proper responsive behavior for the footer
   - Organize footer content logically with clear visual hierarchy
   - Ensure footer links and elements have appropriate spacing` : ''}
${contentType === 'svg' ? 'Output SVG code that is clean, well-structured, and uses appropriate SVG elements and attributes.' : ''}
${contentType === 'dataviz' ? 'Create a data visualization that effectively communicates the information, with clear labels, appropriate colors, and intuitive layout.' : ''}
${contentType === 'diagram' ? 'Create a diagram that clearly illustrates the concept, with appropriate labels, colors, and layout.' : ''}
${contentType === 'infographic' ? 'Create an infographic that effectively communicates the information, with clear sections, appropriate visuals, and intuitive flow.' : ''}
${contentType === 'game' ? 'Create a game with clear instructions, engaging mechanics, and appropriate visuals.' : ''}

Your output should be valid HTML, CSS, and JavaScript code that can be rendered directly in a browser.
The code should be clean, well-commented, and follow best practices.
Include all necessary code in a single file - do not reference external files or libraries unless explicitly requested.
Do NOT include token usage information in your response.`;

    // Prepare the request body with the correct structure for Claude 3.7 Sonnet
    let requestBody: any = {
      model: model,
      max_tokens: 30000,
      stream: stream,
      system: systemPrompt,
    };

    // Always enable thinking for all requests
    requestBody.thinking = {
      type: "enabled",
      budget_tokens: 15000  // Increased budget to encourage more thorough thinking
    };

    // Handle the message content differently based on whether there's an image
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      try {
        // Extract the base64 data from the data URL
        const base64Image = extractBase64FromDataUrl(imageUrl);
        console.log('Successfully extracted base64 data, length:', base64Image.length);
        
        const mediaType = imageUrl.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
        console.log('Detected media type:', mediaType);
        
        // Structure for image-with-text request
        requestBody.messages = [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: partialResponse 
                  ? `${prompt}\n\nUse this as a starting point:\n${partialResponse}\n\nPlease use the attached image as inspiration for the design, including its visual style, color palette, and layout where appropriate.`
                  : `${prompt}\n\nPlease use the attached image as inspiration for the design, including its visual style, color palette, and layout where appropriate.`
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Image
                }
              }
            ]
          }
        ];
      } catch (imageError) {
        console.error('Error processing image data URL:', imageError);
        return new Response(
          JSON.stringify({ error: 'Failed to process image data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Structure for text-only request
      const messageText = partialResponse 
        ? `${prompt}\n\nUse this as a starting point:\n${partialResponse}` 
        : prompt;
        
      requestBody.messages = [
        {
          role: "user",
          content: messageText
        }
      ];
    }

    console.log('Sending request to Anthropic API with Claude 3.7 Sonnet');
    console.log('Request body message contents:', JSON.stringify(requestBody.messages).substring(0, 500));
    console.log('Streaming mode:', stream ? 'Enabled' : 'Disabled');
    console.log('Thinking mode:', requestBody.thinking ? `Enabled (budget: ${requestBody.thinking.budget_tokens})` : 'Disabled');

    // Estimate input tokens (rough approximation)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    let tokenTrackingInfo = null;
    
    // Create initial token tracking records if gameId is provided
    if (gameId) {
      tokenTrackingInfo = await createInitialTokenRecords(
        supabase, 
        gameId, 
        userId, 
        prompt, 
        requestBody.model,
        estimatedInputTokens
      );
      
      if (tokenTrackingInfo) {
        console.log('[TOKEN TRACKING] Initial records created with message ID:', tokenTrackingInfo.messageId);
      } else {
        console.error('[TOKEN TRACKING] Failed to create initial records');
      }
    }

    // Make the request to Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error response:', errorText);
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('Successfully got response from Anthropic API');
    
    // For streaming mode, modify the stream to include a final message with token counts
    if (stream) {
      console.log('Streaming response back to client');
      
      if (response.body) {
        // Use the TransformStream API to modify the stream
        const { readable, writable } = new TransformStream();
        
        // Clone the original stream for reading
        const reader = response.body.getReader();
        const writer = writable.getWriter();
        
        // Variables to track thinking content
        let lastThinkingContent = '';
        // Variable to collect the complete response
        let completeResponse = '';

        // Process the stream in the background
        EdgeRuntime.waitUntil((async () => {
          try {
            let outputTokenCount = 0;
            let completeChunk = '';
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                // Process the complete response to replace image URLs with Pexels images
                if (completeResponse) {
                  try {
                    // Only process HTML content
                    if (contentType === 'website' || contentType === 'html' || completeResponse.includes('<!DOCTYPE html>')) {
                      console.log('Processing HTML content to replace image URLs with Pexels images');
                      const processedContent = await replaceImageUrlsWithPexels(completeResponse, prompt);
                      
                      // If the content was modified, send a special event with the processed content
                      if (processedContent !== completeResponse) {
                        console.log('Successfully replaced image URLs with Pexels images');
                        const processedEvent = `data: ${JSON.stringify({
                          type: 'processed_content',
                          content: processedContent
                        })}\n\n`;
                        
                        await writer.write(new TextEncoder().encode(processedEvent));
                      }
                    }
                  } catch (processingError) {
                    console.error('Error processing content for Pexels images:', processingError);
                  }
                }
              
                // Calculate final token counts
                const finalOutputTokens = Math.max(1, Math.ceil(completeChunk.length / 4));
                console.log('[TOKEN TRACKING] Final output tokens (estimated):', finalOutputTokens);
                
                // Add a final event with token information
                if (tokenTrackingInfo) {
                  // Update token tracking with final values
                  await updateTokenRecords(
                    supabase,
                    tokenTrackingInfo.messageId,
                    estimatedInputTokens,
                    finalOutputTokens
                  );
                  
                  // Add the token info to the stream for internal tracking only, not display
                  const tokenInfoEvent = `data: ${JSON.stringify({
                    type: 'token_usage',
                    usage: {
                      input_tokens: estimatedInputTokens,
                      output_tokens: finalOutputTokens
                    }
                  })}\n\n`;
                  
                  await writer.write(new TextEncoder().encode(tokenInfoEvent));
                }
                
                // Send the [DONE] event
                await writer.write(new TextEncoder().encode('data: [DONE]\n\n'));
                await writer.close();
                break;
              }
              
              // Decode the chunk
              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const eventData = line.slice(5).trim();
                    
                    if (eventData === '[DONE]') {
                      await writer.write(new TextEncoder().encode(line + '\n'));
                      continue;
                    }
                    
                    // For JSON data, we need to parse it
                    if (eventData.startsWith('{')) {
                      const data = JSON.parse(eventData);
                      
                      // Handle thinking content
                      if (data.delta?.type === 'thinking_delta' && data.delta.thinking) {
                        // Update the thinking content
                        if (data.delta.thinking !== lastThinkingContent) {
                          lastThinkingContent = data.delta.thinking;
                          
                          // Forward thinking events directly without modification
                          const thinkingEvent = `data: ${JSON.stringify({
                            type: 'content_block_delta',
                            delta: {
                              type: 'thinking_delta',
                              thinking: data.delta.thinking
                            }
                          })}\n\n`;
                          
                          await writer.write(new TextEncoder().encode(thinkingEvent));
                          continue;
                        }
                      }
                      
                      // For standalone thinking updates (in older API format)
                      if (data.thinking && data.thinking !== lastThinkingContent) {
                        lastThinkingContent = data.thinking;
                        
                        // Forward as a simplified thinking event
                        const thinkingEvent = `data: ${JSON.stringify({ thinking: data.thinking })}\n\n`;
                        await writer.write(new TextEncoder().encode(thinkingEvent));
                        continue;
                      }
                      
                      // For content, filter out token information
                      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta' && data.delta.text) {
                        let contentText = data.delta.text;
                        
                        // Detect and remove token information
                        if (isTokenInfo(contentText)) {
                          // Skip this event entirely if it's only token information
                          if (isOnlyTokenInfo(contentText)) {
                            continue;
                          }
                          
                          // Otherwise, clean the content
                          contentText = removeTokenInfo(contentText);
                          if (!contentText.trim()) {
                            continue;
                          }
                          
                          // Update the object before sending
                          data.delta.text = contentText;
                        }
                        
                        // Add to complete content for token counting
                        completeChunk += contentText;
                        
                        // Forward the modified event
                        await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
                        continue;
                      }
                      
                      // For other events, just forward them as is
                      await writer.write(new TextEncoder().encode(line + '\n'));
                    } else {
                      // For non-JSON data, just forward it
                      await writer.write(new TextEncoder().encode(line + '\n'));
                    }
                  } catch (parseError) {
                    console.error('Error parsing stream event:', parseError);
                    // Forward the original line if we fail to parse it
                    await writer.write(new TextEncoder().encode(line + '\n'));
                  }
                } else if (line.trim()) {
                  // Forward non-data lines
                  await writer.write(new TextEncoder().encode(line + '\n'));
                }
              }
            }
          } catch (streamError) {
            console.error('[STREAM ERROR]', streamError);
            writer.abort(streamError);
          }
        })());
        
        return new Response(readable, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        throw new Error('Stream response body is null');
      }
    } else {
      console.log('Processing non-streaming response');
      const data = await response.json();
      let content = data.content[0]?.text || '';
      
      // For non-streaming responses, process the content to replace image URLs with Pexels images
      if (content && (contentType === 'website' || contentType === 'html' || content.includes('<!DOCTYPE html>'))) {
        console.log('Processing HTML content to replace image URLs with Pexels images');
        content = await replaceImageUrlsWithPexels(content, prompt);
      }
      
      // Remove token information from the response
      content = removeTokenInfo(content);
      
      // Extract token usage information
      const inputTokens = data.usage?.input_tokens || estimatedInputTokens;
      const outputTokens = data.usage?.output_tokens || Math.ceil(content.length / 4);
      
      console.log('Non-streaming response processed, content length:', content.length);
      console.log('Token usage information:', { inputTokens, outputTokens });
      
      // Update token tracking with actual values if available
      if (tokenTrackingInfo) {
        await updateTokenRecords(supabase, tokenTrackingInfo.messageId, inputTokens, outputTokens);
      }
      
      return new Response(
        JSON.stringify({ 
          content,
          usage: { 
            input_tokens: inputTokens,
            output_tokens: outputTokens
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in generate-game function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
