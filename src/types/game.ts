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
    promptPrefix: 'Create a visual mockup of a web application with the following features. Focus on the UI design, layout, and visual elements rather than full functionality:'
  },
  { 
    id: 'mobileapp', 
    label: 'Mobile App', 
    example: 'Create mobile application interfaces and interactions',
    promptPrefix: 'Design a visual mockup of a mobile app interface with the following specifications. Focus on the UI design, screens, and visual elements rather than backend functionality. IMPORTANT: Present the design inside an iPhone canvas/frame so users can visualize it in the proper mobile context:'
  },
  { 
    id: 'website', 
    label: 'Website', 
    example: 'Create complete websites with multiple pages and sections',
    promptPrefix: 'Design a visual mockup of a website with the following requirements. Focus on the layout, styling, and visual elements rather than backend functionality:'
  },
  { 
    id: 'infographic', 
    label: 'Infographic', 
    example: 'Create visual representations of information and data',
    promptPrefix: 'Create a static infographic that visually presents the following information. Use clear visual hierarchy, graphics, and explanatory text:'
  },
  { 
    id: 'game', 
    label: 'Interactive Game', 
    example: 'Create an interactive browser game with engaging gameplay mechanics',
    promptPrefix: 'Create a fully functional interactive browser game with the following gameplay elements. Include working game mechanics, user controls, and scoring system using HTML, CSS, and JavaScript:'
  },
  { 
    id: 'wireframe', 
    label: 'Wireframe', 
    example: 'Create low-fidelity mockups and wireframes',
    promptPrefix: 'Create a low-fidelity wireframe layout for the following concept. Use minimal styling, focus on layout structure, and include placeholder elements:'
  }
] as const;
