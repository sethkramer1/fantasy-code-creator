
import { Button } from "@/components/ui/button";

interface ViewToggleProps {
  showCode: boolean;
  onToggle: (showCode: boolean) => void;
}

export function ViewToggle({ showCode, onToggle }: ViewToggleProps) {
  return (
    <div className="inline-flex bg-gray-50 rounded-md p-1 shadow-sm border border-gray-100">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
          !showCode 
            ? 'bg-white text-gray-800 shadow-sm border border-gray-100' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
        }`}
        onClick={() => onToggle(false)}
      >
        Preview
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
          showCode 
            ? 'bg-white text-gray-800 shadow-sm border border-gray-100' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
        }`}
        onClick={() => onToggle(true)}
      >
        Code
      </Button>
    </div>
  );
}
