
import { MessageSquare, Search } from "lucide-react";

interface GamePromptInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function GamePromptInput({ value, onChange }: GamePromptInputProps) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the game you want to create. Be specific about:
- The type of game (platformer, puzzle, etc.)
- Core gameplay mechanics
- How the player controls the game
- Scoring or winning conditions
- Visual style and theme"
        className="w-full h-48 p-4 rounded-lg bg-white border border-gray-200 focus:ring-2 focus:ring-black/5 focus:outline-none transition-all text-gray-800 placeholder:text-gray-400"
      />
      <div className="absolute right-3 top-3 flex gap-2">
        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <MessageSquare size={18} className="text-gray-400" />
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Search size={18} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
}
