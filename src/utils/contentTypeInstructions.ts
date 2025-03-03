
import { ContentTypeInstructions } from "../types/generation";

export const getContentTypeInstructions = (gameType: string): ContentTypeInstructions => {
  let systemInstructions = "";
  
  switch (gameType) {
    case 'game':
      systemInstructions = `
GAME REQUIREMENTS:
1. Structure:
   - Encapsulated Game class with proper states (loading, playing, paused, game over)
   - No global variables, use requestAnimationFrame for game loop
   - Proper event handling and cleanup

2. Core Features:
   - Functional start/pause/restart buttons
   - Persistent score/lives tracking
   - Mobile-friendly touch controls (44px+ touch areas)
   - Simple asset loading with visual indicators that load correctly

3. Quality & UX:
   - Bounds checking and error prevention
   - Clear instructions, feedback, and game states
   - Visual feedback for all player actions
   - Responsive design for all screen sizes
   - NO music or external APIs
   - Handle orientation changes on mobile

4. Code Quality:
   - Descriptive names and comments for key functions
   - Try-catch blocks around critical functions
   - Performance optimization for mobile
   - Canvas that adjusts to iframe container size
   - Self-contained code (no external dependencies)
`;
      break;
    case 'svg':
      systemInstructions = `
SVG REQUIREMENTS:
1. Structure:
- Use proper SVG namespace
- Implement clean, semantic element structure
- Optimize paths and shapes
- Use appropriate viewBox dimensions
- Include proper metadata

2. Styling:
- Use efficient CSS styling
- Implement proper fill and stroke attributes
- Use transforms where appropriate
- Add animations if specified
- Include responsive scaling

3. Optimization:
- Minimize path points
- Remove unnecessary attributes
- Use appropriate precision
- Implement proper grouping
- Clean and format code`;
      break;
    case 'webdesign':
      systemInstructions = `
WEB DESIGN REQUIREMENTS:
1. Structure:
- If the user asks for a mobile design, mobile UI, or anything similar for a mobile device, the design should be wrapped in an iPhone container showing the status bar and home indicator.
 In this case, create a mobile UI design inside an iPhone frame so the user can see what the design mock up looks like in an iphone frame since it is a mobile UI design.
- Use semantic HTML5 elements
- Implement proper heading hierarchy
- Include meta tags
- Add responsive viewport settings
- Use proper document structure

2. Styling:
- Implement mobile-first responsive design
- Use modern CSS features
- Include hover and focus states
- Add smooth transitions
- Support dark/light modes

3. Components:
- Create reusable components
- Add proper spacing
- Include loading states
- Implement error states
- Use consistent styling

4. Accessibility:
- Add ARIA labels
- Use semantic HTML
- Include keyboard navigation
- Implement proper color contrast
- Add focus indicators

5. Container:
- If the user asks for a mobile UI, wrap the design in an iphone container

6. Image Usage:
- When using Unsplash images, ONLY use valid, real Unsplash URLs (https://source.unsplash.com/...)
- Never make up or invent Unsplash image URLs
- If you need a placeholder image, use a proper placeholder service instead of making up an Unsplash URL
`;
      break;
    case 'dataviz':
      systemInstructions = `
DATA VISUALIZATION REQUIREMENTS:
1. Structure:
- Use appropriate chart type
- Implement proper axes
- Add clear labels
- Include legends where needed
- Use responsive sizing

2. Interaction:
- Add hover states
- Include tooltips
- Implement zooming if needed
- Add click interactions
- Support touch devices

3. Accessibility:
- Add ARIA labels
- Include alt text
- Support keyboard navigation
- Use proper color contrast
- Add screen reader support`;
      break;
    case 'diagram':
      systemInstructions = `
DIAGRAM REQUIREMENTS:
1. Structure:
- Use clear layout
- Implement proper spacing
- Add directional indicators
- Include proper labels
- Use consistent styling

2. Components:
- Create clear nodes
- Add proper connections
- Include labels
- Use appropriate icons
- Implement grouping

3. Styling:
- Use consistent colors
- Add proper spacing
- Include hover states
- Implement highlights
- Use appropriate fonts`;
      break;
    case 'infographic':
      systemInstructions = `
INFOGRAPHIC REQUIREMENTS:
1. Structure:
- Use clear sections
- Implement proper flow
- Add visual hierarchy
- Include proper spacing
- Use consistent layout

2. Content:
- Create clear headings
- Add proper icons
- Include data visualizations
- Use appropriate typography
- Implement consistent styling

3. Accessibility:
- Add alt text
- Use proper contrast
- Include screen reader support
- Implement proper spacing
- Use semantic structure`;
      break;
    default:
      systemInstructions = "Create content based on the user's requirements with clean, maintainable code.";
  }

  // Image usage instructions for all content types
  systemInstructions += `

IMPORTANT IMAGE USAGE INSTRUCTIONS:
- When using Unsplash images, ONLY use valid, real Unsplash URLs (https://source.unsplash.com/...)
- Never make up or invent Unsplash image URLs
- If you need a placeholder image, use a proper placeholder service instead of making up an Unsplash URL

IMPORTANT CODE LIMITATIONS:
- The resulting code will be written in HTML, JS, and CSS only
- Do not include server-side code, backend functionality, or external APIs that require server implementation
- Keep all functionality client-side and self-contained
`;

  // Enhanced emphasis for mobile UI wrapping in iPhone container
  if (gameType === 'webdesign') {
    const mobileEmphasis = `
IMPORTANT MOBILE INSTRUCTION:
This is a mobile UI design request. You MUST wrap the final design in an iPhone container showing 
the status bar at the top and home indicator at the bottom. The design should appear as if it's 
being displayed on an actual iPhone device to provide proper context for the mobile UI design.

ENSURE INTERACTION CAPABILITIES:
- The content inside the iPhone container MUST be fully functional
- Users should be able to scroll the content if it extends beyond the viewport
- All interactive elements (buttons, links, inputs) should be clickable and functional
- Touch events should work properly on the content within the frame
- Test that the scrolling works by adding sufficient content to require scrolling
- Make sure to use proper overflow settings to enable scrolling
`;
    systemInstructions = mobileEmphasis + systemInstructions;
  }

  return { gameType, systemInstructions };
};

export const formatSvgContent = (content: string): string => {
  // For SVG content type, wrap the SVG in basic HTML if it's just raw SVG
  if (!content.includes('<!DOCTYPE html>')) {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    svg { max-width: 100%; max-height: 100vh; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }
  return content;
};

export const ensureValidHtml = (content: string): string => {
  // Final check to ensure we have valid HTML content
  if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
    // If we've collected enough content, try to make it valid HTML
    if (content.length > 500) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
</head>
<body>
  ${content}
</body>
</html>`;
    }
  }
  return content;
};
