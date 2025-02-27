
import { contentTypes } from "@/types/game";

interface GameTypeSelectorProps {
  selectedType: string;
  onSelect: (type: string) => void;
}

export function GameTypeSelector({ selectedType, onSelect }: GameTypeSelectorProps) {
  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-3">Choose what you want to create</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contentTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelect(type.id === selectedType ? "" : type.id)}
            className={`p-4 rounded-lg border ${
              type.id === selectedType 
                ? 'border-black bg-black text-white' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            } transition-all text-left h-full group`}
          >
            <h3 className="font-medium mb-2">{type.label}</h3>
            <p className={`text-sm ${
              type.id === selectedType ? 'text-gray-300' : 'text-gray-500'
            }`}>
              {type.example}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
