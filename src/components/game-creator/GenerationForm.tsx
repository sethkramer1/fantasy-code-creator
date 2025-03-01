
import { Loader2, Terminal, Wand2 } from "lucide-react";
import { GameTypeSelector } from "./GameTypeSelector";
import { GamePromptInput } from "./GamePromptInput";
import { Switch } from "@/components/ui/switch";

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
  modelType = "smart",
  setModelType = () => {}
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
        
        <div className="space-y-3">
          <p className="font-medium text-gray-700">Model preference</p>
          <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 flex-1">
              <div className={`p-2.5 rounded-lg ${modelType === "smart" ? 'bg-black text-white' : 'bg-gray-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4Z"></path>
                  <circle cx="12" cy="14" r="2"></circle>
                  <path d="M12 12v0"></path>
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-medium">Smartest</h3>
                <p className="text-xs text-gray-500">Higher quality</p>
              </div>
            </div>
            
            <Switch
              checked={modelType === "fast"}
              onCheckedChange={() => setModelType(modelType === "smart" ? "fast" : "smart")}
            />
            
            <div className="flex items-center gap-3 flex-1">
              <div className={`p-2.5 rounded-lg ${modelType === "fast" ? 'bg-black text-white' : 'bg-gray-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-medium">Fastest</h3>
                <p className="text-xs text-gray-500">Quick response</p>
              </div>
            </div>
          </div>
        </div>
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
              className="p-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors hover:border-gray-300 shadow-sm focus-ring"
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
