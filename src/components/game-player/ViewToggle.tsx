
import { Button } from "@/components/ui/button";

interface ViewToggleProps {
  showCode: boolean;
  onToggle: (showCode: boolean) => void;
}

export function ViewToggle({ showCode, onToggle }: ViewToggleProps) {
  return (
    <div className="inline-flex bg-zinc-800 rounded-lg p-1 h-10">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          !showCode 
            ? 'bg-zinc-700 text-white' 
            : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-white'
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
            ? 'bg-zinc-700 text-white' 
            : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-white'
        }`}
        onClick={() => onToggle(true)}
      >
        Code
      </Button>
    </div>
  );
}
