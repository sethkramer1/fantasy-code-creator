
import { contentTypes } from "@/types/game";

// Helper function to get content type information
const getContentTypeInfo = (gameType: string) => {
  const contentType = contentTypes.find(type => type.id === gameType);
  return contentType || contentTypes.find(type => type.id === 'game')!;
};

// Get the appropriate system prompt based on content type
export const getSystemPrompt = (gameType: string) => {
  const contentType = getContentTypeInfo(gameType);
  
  // Base system prompt for all content types
  const basePrompt = `You are an expert web developer who specializes in creating engaging interactive ${contentType.label.toLowerCase()} experiences. 
You write clean, well-structured code and explain your decisions clearly.

When responding to a prompt, you should:
1. Understand the requirements fully
2. Plan a solution using HTML, CSS, and JavaScript
3. Implement a complete, working solution using best practices
4. Ensure your code is responsive and accessible
5. Add helpful comments to explain complex parts

Always aim to create something impressive, functional, and visually appealing.`;

  // Customize system prompt based on content type
  switch (gameType) {
    case 'webdesign':
      return `${basePrompt}\n\nFocus on creating clean, modern web designs with responsive layouts, using flexbox, CSS grid, and mobile-first principles.`;
    case 'game':
      return `${basePrompt}\n\nCreate entertaining and interactive games with clear rules, engaging mechanics, and satisfying feedback.`;
    case 'svg':
      return `${basePrompt}\n\nCreate vector graphics that are optimized, scalable, and use modern SVG techniques. Return only valid SVG code.`;
    case 'dataviz':
      return `${basePrompt}\n\nCreate data visualizations that clearly communicate information through appropriate chart types, colors, and interactions.`;
    case 'diagram':
      return `${basePrompt}\n\nCreate clear, organized diagrams that effectively illustrate concepts, processes, or relationships through thoughtful layout and design.`;
    case 'infographic':
      return `${basePrompt}\n\nCreate visually engaging infographics that combine data, text, and graphics to explain complex information in an accessible way.`;
    default:
      return basePrompt;
  }
};
