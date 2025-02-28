
import { contentTypes } from "@/types/game";
import { useRef, useEffect } from "react";

interface GamePromptInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedType: string;
}

export function GamePromptInput({ value, onChange, selectedType }: GamePromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  const getPlaceholder = () => {
    const type = contentTypes.find(t => t.id === selectedType);
    
    switch (selectedType) {
      case 'svg':
        return `Describe the SVG graphic you want to create. Be specific about:
- The type of graphic (logo, icon, illustration)
- Style and design elements
- Colors and shapes
- Size and proportions
- Any text or typography requirements`;
      case 'webdesign':
        return `Describe the web design you want to create. Be specific about:
- Purpose and target audience
- Layout and structure
- Color scheme and typography
- Key components and sections
- Responsive design requirements`;
      case 'dataviz':
        return `Describe the data visualization you want to create. Be specific about:
- Type of visualization (chart, graph, etc.)
- Data points and relationships to show
- Interactive features needed
- Color scheme and styling
- Labels and legends`;
      case 'diagram':
        return `Describe the diagram you want to create. Be specific about:
- Type of diagram (flowchart, sequence, etc.)
- Elements and connections
- Layout and direction
- Labels and annotations
- Color scheme and styling`;
      case 'infographic':
        return `Describe the infographic you want to create. Be specific about:
- Topic and main message
- Key data points or information
- Visual style and layout
- Icons and illustrations needed
- Text and typography`;
      case 'game':
      default:
        return `Describe the game you want to create. Be specific about:
- The type of game (platformer, puzzle, etc.)
- Core gameplay mechanics
- How the player controls the game
- Scoring or winning conditions
- Visual style and theme`;
    }
  };

  return (
    <div className="relative">
      <p className="font-medium text-gray-700 mb-3">Describe what you want</p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={getPlaceholder()}
        className="w-full p-4 rounded-xl bg-white border border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all text-gray-800 placeholder:text-gray-400 min-h-[120px] resize-none shadow-sm"
        style={{ overflow: 'hidden' }}
      />
    </div>
  );
}
