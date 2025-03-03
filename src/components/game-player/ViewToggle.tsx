
import { Button } from "@/components/ui/button";

interface ViewToggleProps {
  showCode: boolean;
  onToggle: (showCode: boolean) => void;
}

export function ViewToggle({ showCode, onToggle }: ViewToggleProps) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 h-9">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          !showCode 
            ? 'bg-white text-gray-800 shadow-sm' 
            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
        }`}
        onClick={() => onToggle(false)}
      >
        Preview
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          showCode 
            ? 'bg-white text-gray-800 shadow-sm' 
            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
        }`}
        onClick={() => onToggle(true)}
      >
        Code
      </Button>
    </div>
  );
}
