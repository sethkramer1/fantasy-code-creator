import { contentTypes } from "@/types/game";
import { 
  Layout, 
  Gamepad, 
  Globe,
  Smartphone,
  PieChart,
  PenSquare
} from "lucide-react";

interface GameTypeSelectorProps {
  selectedType: string;
  onSelect: (type: string) => void;
}

export function GameTypeSelector({ selectedType, onSelect }: GameTypeSelectorProps) {
  // Map of icons for each content type
  const typeIcons = {
    'webapp': Layout,
    'mobileapp': Smartphone,
    'website': Globe,
    'infographic': PieChart,
    'game': Gamepad,
    'wireframe': PenSquare
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {contentTypes.map((type) => {
          const IconComponent = typeIcons[type.id as keyof typeof typeIcons];
          const isSelected = type.id === selectedType;
          
          return (
            <button
              key={type.id}
              onClick={() => onSelect(type.id === selectedType ? "" : type.id)}
              className={`relative p-3 rounded-xl border transition-all duration-200 hover-scale focus-ring ${
                isSelected 
                  ? 'border-gray-400 bg-black text-white shadow-md' 
                  : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  isSelected 
                    ? 'bg-white/20' 
                    : 'bg-gray-50 group-hover:bg-gray-100'
                }`}>
                  <IconComponent size={20} className={
                    isSelected ? 'text-white' : 'text-gray-700'
                  } />
                </div>
                <h3 className={`font-medium ${isSelected ? 'text-white' : ''}`}>{type.label}</h3>
              </div>
              
              {isSelected && (
                <div className="absolute inset-0 border-2 border-gray-400 rounded-xl pointer-events-none"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
