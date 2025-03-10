
import { Button } from "@/components/ui/button";
import { Code, Eye } from "lucide-react";

interface ViewToggleProps {
  showCode: boolean;
  onToggle: (showCode: boolean) => void;
}

export function ViewToggle({ showCode, onToggle }: ViewToggleProps) {
  return (
    <div className="inline-flex bg-gradient-to-r from-gray-50 to-gray-100 rounded-full p-1 shadow-sm border border-gray-200 backdrop-blur-sm">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded-full px-4 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-all duration-200 ${
          !showCode 
            ? 'bg-white text-indigo-700 shadow-md border border-gray-200 transform scale-[1.02]' 
            : 'text-gray-600 hover:bg-white/70 hover:text-indigo-600'
        }`}
        onClick={() => onToggle(false)}
      >
        <Eye size={16} className="stroke-[2.5px]" />
        <span>Preview</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded-full px-4 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-all duration-200 ${
          showCode 
            ? 'bg-white text-indigo-700 shadow-md border border-gray-200 transform scale-[1.02]' 
            : 'text-gray-600 hover:bg-white/70 hover:text-indigo-600'
        }`}
        onClick={() => onToggle(true)}
      >
        <Code size={16} className="stroke-[2.5px]" />
        <span>Code</span>
      </Button>
    </div>
  );
}
