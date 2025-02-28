
export interface Game {
  id: string;
  prompt: string;
  code: string;
  instructions: string | null;
  created_at: string;
  current_version: number | null;
  type: string;
  thumbnail_url?: string | null;
}

export interface GameVersion {
  id: string;
  game_id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
  image_url?: string | null;
}

export interface GameMessage {
  id: string;
  game_id: string;
  message: string;
  response: string | null;
  created_at: string;
  image_url?: string | null;
}

export const contentTypes = [
  {
    id: 'game',
    label: 'Interactive Game',
    promptPrefix: 'Create an interactive JavaScript game using HTML Canvas with the following concept:',
    description: 'Create playable games like Snake, Tetris, or simple platformers'
  },
  {
    id: 'svg',
    label: 'SVG Graphic',
    promptPrefix: 'Create an SVG graphic with the following description:',
    description: 'Generate vector graphics, illustrations or icons'
  },
  {
    id: 'webdesign',
    label: 'Web Design Prototype',
    promptPrefix: 'Create a responsive web design prototype for:',
    description: 'Design website layouts or interface prototypes'
  },
  {
    id: 'dataviz',
    label: 'Data Visualization',
    promptPrefix: 'Create a data visualization for the following data:',
    description: 'Visualize data with charts, graphs or interactive displays'
  },
  {
    id: 'diagram',
    label: 'Diagram',
    promptPrefix: 'Create a diagram illustrating:',
    description: 'Create flowcharts, mind maps, UML or technical diagrams'
  },
  {
    id: 'infographic',
    label: 'Infographic',
    promptPrefix: 'Create an infographic about:',
    description: 'Design visual representations of information or data'
  }
];
