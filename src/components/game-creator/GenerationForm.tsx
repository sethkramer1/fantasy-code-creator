
import { Loader2, Terminal, Wand2, Info } from "lucide-react";
import { GameTypeSelector } from "./GameTypeSelector";
import { GamePromptInput } from "./GamePromptInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GenerationFormProps {
  gameType: string;
  setGameType: (type: string) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  loading: boolean;
  showTerminalOutput: () => void;
  hasTerminalOutput: boolean;
  imageUrl?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
  modelType?: string;
  setModelType?: (type: string) => void;
  showModelPreference?: boolean;
}

export function GenerationForm({
  gameType,
  setGameType,
  prompt,
  setPrompt,
  onGenerate,
  loading,
  showTerminalOutput,
  hasTerminalOutput,
  imageUrl,
  onImageUploaded,
  onImageRemoved,
  modelType = "smart", // Changed default from "fast" to "smart"
  setModelType = () => {},
  showModelPreference = false
}: GenerationFormProps) {
  return (
    <div className="glass-panel p-8 space-y-6 card-shadow">
      <div className="space-y-6">
        <GameTypeSelector 
          selectedType={gameType}
          onSelect={setGameType}
        />
        <GamePromptInput 
          value={prompt}
          onChange={setPrompt}
          selectedType={gameType}
          onImageUploaded={onImageUploaded}
          onImageRemoved={onImageRemoved}
          imageUrl={imageUrl}
        />
        
        {showModelPreference && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-700">Model preference</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <Info size={16} className="text-gray-400 hover:text-gray-600" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3">
                    <p>Choose the model that best fits your needs:</p>
                    <ul className="mt-2 text-sm list-disc pl-4 space-y-1">
                      <li><strong>Fastest</strong>: Ideal for small edits like color or text edits - 5x faster to iterate with good results.</li>
                      <li><strong>Smartest</strong>: Best results but takes longer to generate. Supports image uploads.</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={modelType} onValueChange={setModelType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                    </svg>
                    <div>
                      <span>Fastest (Groq)</span>
                      <span className="ml-2 text-xs text-green-600 font-medium">5x faster</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="smart">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4Z"></path>
                      <circle cx="12" cy="14" r="2"></circle>
                      <path d="M12 12v0"></path>
                    </svg>
                    <span>Smartest (Claude)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      <div className="pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onGenerate}
            disabled={loading}
            className="flex-1 py-3 px-6 rounded-xl bg-black text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-medium shadow-md hover:shadow-lg focus-ring"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Wand2 size={20} />
                <span>Generate</span>
              </>
            )}
          </button>
          {hasTerminalOutput && (
            <button
              onClick={showTerminalOutput}
              className="p-3 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors hover:border-gray-300 shadow-sm focus-ring aspect-square flex items-center justify-center"
              title="Show generation progress"
            >
              <Terminal size={20} className="text-gray-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
