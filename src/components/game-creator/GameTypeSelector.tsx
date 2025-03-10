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
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {contentTypes.map((type) => {
          const IconComponent = typeIcons[type.id as keyof typeof typeIcons];
          const isSelected = type.id === selectedType;
          
          return (
            <button
              key={type.id}
              onClick={() => onSelect(type.id === selectedType ? "" : type.id)}
              className={`relative py-2 px-3 rounded-xl border transition-all duration-200 focus-ring ${
                isSelected 
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`p-1.5 rounded-lg ${
                  isSelected 
                    ? 'bg-indigo-100' 
                    : 'bg-gray-50 group-hover:bg-gray-100'
                }`}>
                  <IconComponent size={18} className={
                    isSelected ? 'text-indigo-600' : 'text-gray-600'
                  } />
                </div>
                <h3 className={`text-sm font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>{type.label}</h3>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
