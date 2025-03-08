export interface Game {
  id: string;
  prompt: string;
  created_at: string;
  type?: string;
  thumbnail_url?: string;
  user_id?: string;
  visibility?: string;
  deleted?: boolean;
  name?: string;
}

export interface GameData {
  id: string;
  code: string;
  prompt: string;
  type?: string;
  created_at: string;
  current_version?: number;
  model_type?: string;
  visibility?: string;
  instructions?: string;
  user_id?: string;
  name?: string;
}

export const contentTypes = [
  { 
    id: 'webapp', 
    label: 'Web App', 
    example: 'Create interactive web applications with user interfaces',
    promptPrefix: 'Create a visual mockup of a web application with the following features. IMPORTANT DESIGN GUIDELINES: Use a cohesive color palette with no more than 3-4 primary colors. Implement proper spacing with consistent padding/margins (16px, 24px, 32px). Use modern UI patterns like cards, floating elements, and subtle shadows. Include realistic data examples instead of Lorem Ipsum. Design with a clear visual hierarchy emphasizing the most important elements. Focus on the UI design, layout, and visual elements rather than full functionality:'
  },
  { 
    id: 'mobileapp', 
    label: 'Mobile App', 
    example: 'Create mobile application interfaces and interactions',
    promptPrefix: 'Design a visual mockup of a mobile app interface with the following specifications. IMPORTANT DESIGN GUIDELINES: Follow iOS/Material Design principles with proper component spacing (8px grid system). Use native mobile UI patterns (tab bars, navigation bars, cards). Implement proper touch target sizes (minimum 44x44px). Use a limited color palette with one accent color. Include status bar and realistic device chrome. Present the design inside an iPhone/Android frame so users can visualize it in the proper mobile context:'
  },
  { 
    id: 'website', 
    label: 'Website', 
    example: 'Create complete websites with multiple pages and sections',
    promptPrefix: 'Design a visual mockup of a website with the following requirements. IMPORTANT DESIGN GUIDELINES: Use a responsive grid layout (12-column recommended). Implement proper typography hierarchy with no more than 2-3 font families. Use whitespace strategically (minimum 24px between sections). Include realistic navigation, footer, and call-to-action elements. Design with accessibility in mind (proper contrast ratios, readable font sizes). Focus on the layout, styling, and visual elements rather than backend functionality:'
  },
  { 
    id: 'infographic', 
    label: 'Infographic', 
    example: 'Create visual representations of information and data',
    promptPrefix: 'Create a static infographic that visually presents the following information. IMPORTANT DESIGN GUIDELINES: Use a consistent visual language throughout (icons, colors, typography). Implement a clear reading flow with numbered sections or visual cues. Use data visualization best practices for any charts or graphs (proper labels, scales, legends). Limit text to essential information with clear hierarchy. Use a cohesive color scheme that enhances data understanding. Include proper citations or data sources:'
  },
  { 
    id: 'game', 
    label: 'Interactive Game', 
    example: 'Create an interactive browser game with engaging gameplay mechanics',
    promptPrefix: 'Create a fully functional interactive browser game with the following gameplay elements. IMPORTANT DESIGN GUIDELINES: Design with a cohesive visual theme and art style. Use consistent UI elements for score, lives, and controls. Implement proper game feedback (visual/audio cues for actions). Design responsive layouts that work across device sizes. Use animation and transitions purposefully. Include working game mechanics, user controls, and scoring system using HTML, CSS, and JavaScript:'
  },
  { 
    id: 'wireframe', 
    label: 'Wireframe', 
    example: 'Create low-fidelity mockups and wireframes',
    promptPrefix: 'Create a low-fidelity wireframe layout for the following concept. IMPORTANT DESIGN GUIDELINES: Use a consistent grid system with proper alignment. Include only essential UI elements with clear labels. Use appropriate placeholder patterns for images and icons. Implement proper information hierarchy with varying element sizes. Use minimal styling, focus on layout structure, and include placeholder elements:'
  }
] as const;
