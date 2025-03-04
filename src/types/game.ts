export interface Game {
  id: string;
  prompt: string;
  created_at: string;
  type?: string;
  thumbnail_url?: string;
  user_id?: string;
  visibility?: string;
  deleted?: boolean;
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
}

export const contentTypes = [
  { 
    id: 'webdesign', 
    label: 'Web Design Prototype', 
    example: 'Create responsive webpage layouts and UI components',
    promptPrefix: 'Create a web design prototype with the following requirements. Include responsive design:'
  },
  { 
    id: 'game', 
    label: 'Interactive Game', 
    example: 'Create an interactive browser game with engaging gameplay mechanics',
    promptPrefix: 'Create an interactive game with the following requirements:'
  },
  { 
    id: 'svg', 
    label: 'SVG Graphic', 
    example: 'Create vector graphics, logos, or illustrations',
    promptPrefix: 'Create an SVG graphic with the following requirements. Return ONLY the SVG code:'
  },
  { 
    id: 'dataviz', 
    label: 'Data Visualization', 
    example: 'Create charts, graphs, and interactive data visualizations',
    promptPrefix: 'Create a data visualization with the following requirements. Use D3.js or Chart.js:'
  },
  { 
    id: 'diagram', 
    label: 'Diagram', 
    example: 'Create flowcharts, sequence diagrams, or architecture diagrams',
    promptPrefix: 'Create a diagram with the following requirements. Use SVG or HTML/CSS:'
  },
  { 
    id: 'infographic', 
    label: 'Infographic', 
    example: 'Create visual representations of information and data',
    promptPrefix: 'Create an infographic with the following requirements. Use HTML and CSS:'
  }
] as const;
