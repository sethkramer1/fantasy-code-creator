
import { contentTypes } from "@/types/game";
import { ContentTypeInstructions } from "../types/generation";

export const getContentTypeInstructions = (contentTypeId: string): ContentTypeInstructions => {
  const contentType = contentTypes.find(type => type.id === contentTypeId);
  
  if (!contentType) {
    return {
      systemInstructions: getDefaultInstructions(),
      promptPrefix: "Create"
    };
  }
  
  switch (contentTypeId) {
    case 'webdesign':
      return {
        systemInstructions: getWebDesignInstructions(),
        promptPrefix: "Design a website for"
      };
    case 'webcomponent':
      return {
        systemInstructions: getWebComponentInstructions(),
        promptPrefix: "Create a web component for"
      };
    case 'svg':
      return {
        systemInstructions: getSvgInstructions(),
        promptPrefix: "Create an SVG illustration of"
      };
    case 'visualization':
      return {
        systemInstructions: getVisualizationInstructions(),
        promptPrefix: "Create a data visualization for"
      };
    case 'animation':
      return {
        systemInstructions: getAnimationInstructions(),
        promptPrefix: "Create an animation of"
      };
    case 'ui':
      return {
        systemInstructions: getUIInstructions(),
        promptPrefix: "Design a user interface for"
      };
    default:
      return {
        systemInstructions: getDefaultInstructions(),
        promptPrefix: "Create"
      };
  }
};

export const formatSvgContent = (content: string): string => {
  // Check if content is already valid SVG
  if (content.trim().startsWith('<svg') && content.trim().endsWith('</svg>')) {
    return wrapSvgInHtml(content);
  }
  
  // Try to extract SVG from HTML content
  const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/);
  if (svgMatch && svgMatch[0]) {
    return wrapSvgInHtml(svgMatch[0]);
  }
  
  // If no SVG found, return original content wrapped in HTML
  return ensureValidHtml(content);
};

// Wrap SVG content in proper HTML document for rendering
const wrapSvgInHtml = (svgContent: string): string => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SVG Illustration</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: #f5f5f5;
    }
    .svg-container {
      max-width: 90vw;
      max-height: 90vh;
    }
    svg {
      width: 100%;
      height: 100%;
      max-width: 800px;
    }
  </style>
</head>
<body>
  <div class="svg-container">
    ${svgContent}
  </div>
</body>
</html>`;
};

// Ensure content is valid HTML
export const ensureValidHtml = (content: string): string => {
  if (content.includes('<html') || content.includes('<!DOCTYPE')) {
    return content;
  }
  
  // Content has HTML elements but is not a full document
  if (content.includes('<') && content.includes('>')) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }
  
  // Plain text content
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Content</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
  </style>
</head>
<body>
  <pre>${content}</pre>
</body>
</html>`;
};

// Default system instructions
const getDefaultInstructions = (): string => {
  return `You are an expert HTML, CSS, and JavaScript developer who creates interactive web content.
Please generate complete, self-contained HTML code based on the user's request.
Your HTML should:
- Include proper doctype, html, head and body tags
- Have all CSS in a style tag in the head
- Have all JavaScript in a script tag at the end of the body
- Be ready to render in a browser with no additional files
- Be visually appealing with a clean, modern design
- Be responsive and mobile-friendly
- Use semantic HTML5 elements
- Be accessible with proper ARIA attributes where needed
- Avoid external dependencies when possible (no CDN links)
- Include helpful comments explaining key parts of your code

Return ONLY the complete HTML code with no additional text, explanations, or markdown formatting.`;
};

// Domain-specific system instructions
const getWebDesignInstructions = (): string => {
  return `You are an expert web designer and frontend developer who creates beautiful, modern websites.
Please generate complete, self-contained HTML code for a website based on the user's description.
Your HTML should:
- Include proper doctype, html, head and body tags
- Include viewport meta tag and other appropriate meta tags
- Have all CSS in a style tag in the head
- Have all JavaScript in a script tag at the end of the body
- Be ready to render in a browser with no additional files
- Be visually appealing with a clean, modern design
- Be fully responsive and mobile-friendly
- Include proper navigation, hero section, and other typical website components
- Use semantic HTML5 elements and follow accessibility best practices
- Avoid external dependencies when possible (no CDN links)

Return ONLY the complete HTML code with no additional text, explanations, or markdown formatting.`;
};

const getWebComponentInstructions = (): string => {
  return `You are an expert frontend developer who specializes in creating reusable web components.
Please generate complete, self-contained HTML code for a web component based on the user's description.
Your HTML should:
- Include proper doctype, html, head and body tags for demonstration
- Have all CSS in a style tag in the head
- Have all JavaScript in a script tag at the end of the body
- Implement the component using either native Web Components (Custom Elements) or a clean vanilla JS approach
- Be ready to render in a browser with no additional files
- Be visually appealing with a clean, modern design
- Be responsive and mobile-friendly
- Use semantic HTML5 elements and follow accessibility best practices
- Avoid external dependencies when possible (no CDN links)
- Include helpful comments explaining how to use and customize the component

Return ONLY the complete HTML code with no additional text, explanations, or markdown formatting.`;
};

const getSvgInstructions = (): string => {
  return `You are an expert SVG artist and developer who creates beautiful vector graphics and illustrations.
Please generate complete, self-contained SVG code based on the user's description.
Your SVG should:
- Be well-formed with proper namespace declarations
- Use appropriate SVG elements (path, circle, rect, g, etc.)
- Include a viewBox attribute
- Have clean, optimized code
- Use a harmonious color scheme
- Include subtle details and artistic elements to enhance visual appeal
- Avoid unnecessary complexity that would increase file size
- Use CSS for styling when appropriate
- Include descriptive IDs and classes for elements
- Be accessible with proper ARIA attributes where needed

Return the SVG code embedded in a simple HTML document for viewing.
Return ONLY the complete HTML code with no additional text, explanations, or markdown formatting.`;
};

const getVisualizationInstructions = (): string => {
  return `You are an expert data visualization developer who creates interactive, insightful visual representations of data.
Please generate complete, self-contained HTML code for a data visualization based on the user's description.
Your HTML should:
- Include proper doctype, html, head and body tags
- Have all CSS in a style tag in the head
- Have all JavaScript in a script tag at the end of the body
- Use vanilla JavaScript or simple SVG manipulation (no external libraries)
- Include sample data that's relevant to the visualization type
- Be ready to render in a browser with no additional files
- Be visually appealing with a clean, modern design
- Include appropriate labels, legends, axes, and other elements needed for understanding
- Use an appropriate color scheme for data representation
- Be responsive where appropriate
- Use semantic HTML5 elements and follow accessibility best practices

Return ONLY the complete HTML code with no additional text, explanations, or markdown formatting.`;
};

const getAnimationInstructions = (): string => {
  return `You are an expert web animator who creates engaging, performant animations using CSS and JavaScript.
Please generate complete, self-contained HTML code for an animation based on the user's description.
Your HTML should:
- Include proper doctype, html, head and body tags
- Have all CSS in a style tag in the head
- Have all JavaScript in a script tag at the end of the body
- Use CSS animations/transitions or requestAnimationFrame for optimal performance
- Avoid heavy animation libraries
- Be ready to render in a browser with no additional files
- Be visually appealing with a clean, modern design
- Have smooth, fluid animations that run at 60fps
- Include controls to play/pause/reset when appropriate
- Use semantic HTML5 elements and follow accessibility best practices (including respecting prefers-reduced-motion)

Return ONLY the complete HTML code with no additional text, explanations, or markdown formatting.`;
};

const getUIInstructions = (): string => {
  return `You are an expert UI designer and frontend developer who creates beautiful, functional user interfaces.
Please generate complete, self-contained HTML code for a user interface based on the user's description.
Your HTML should:
- Include proper doctype, html, head and body tags
- Have all CSS in a style tag in the head
- Have all JavaScript in a script tag at the end of the body
- Implement a clean, modern UI with appropriate interactions
- Be ready to render in a browser with no additional files
- Be visually appealing with careful attention to typography, spacing, and color
- Be fully responsive and mobile-friendly
- Include appropriate hover, focus, and active states for interactive elements
- Use semantic HTML5 elements and follow accessibility best practices
- Avoid external dependencies when possible (no CDN links)

Return ONLY the complete HTML code with no additional text, explanations, or markdown formatting.`;
};
