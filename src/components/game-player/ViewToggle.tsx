
import { Button } from "@/components/ui/button";

interface ViewToggleProps {
  showCode: boolean;
  setShowCode: (show: boolean) => void;
}

export function ViewToggle({ showCode, setShowCode }: ViewToggleProps) {
  return (
    <div className="bg-zinc-900 p-0.5 rounded-full">
      <Button
        variant="ghost"
        size="sm"
        className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
          !showCode 
            ? 'bg-white text-black' 
            : 'text-white hover:bg-white/20'
        }`}
        onClick={() => setShowCode(false)}
      >
        Preview
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
          showCode 
            ? 'bg-white text-black' 
            : 'text-white hover:bg-white/20'
        }`}
        onClick={() => setShowCode(true)}
      >
        Code
      </Button>
    </div>
  );
}
