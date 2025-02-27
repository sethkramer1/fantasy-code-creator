
import { contentTypes } from "@/types/game";
import { 
  Gamepad, 
  PenTool, 
  Layout, 
  BarChart, 
  Network, 
  PieChart
} from "lucide-react";

interface GameTypeSelectorProps {
  selectedType: string;
  onSelect: (type: string) => void;
}

export function GameTypeSelector({ selectedType, onSelect }: GameTypeSelectorProps) {
  // Map of icons for each content type
  const typeIcons = {
    'game': Gamepad,
    'svg': PenTool,
    'webdesign': Layout,
    'dataviz': BarChart,
    'diagram': Network,
    'infographic': PieChart
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {contentTypes.map((type) => {
          const IconComponent = typeIcons[type.id as keyof typeof typeIcons];
          return (
            <button
              key={type.id}
              onClick={() => onSelect(type.id === selectedType ? "" : type.id)}
              className={`p-3 rounded-lg border ${
                type.id === selectedType 
                  ? 'border-black bg-black text-white' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } transition-all text-left flex items-center gap-2 group`}
            >
              <div className={`p-1.5 rounded-md ${
                type.id === selectedType 
                  ? 'bg-white/20' 
                  : 'bg-gray-100 group-hover:bg-gray-200'
              } transition-colors`}>
                <IconComponent size={18} className={
                  type.id === selectedType ? 'text-white' : 'text-gray-700'
                } />
              </div>
              <h3 className="font-medium">{type.label}</h3>
            </button>
          );
        })}
      </div>
    </div>
  );
}
