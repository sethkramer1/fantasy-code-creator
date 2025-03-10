
import { Loader2, Terminal, Wand2, Info, EyeOff, Eye } from "lucide-react";
import { GameTypeSelector } from "./GameTypeSelector";
import { GamePromptInput } from "./GamePromptInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ModelType } from "@/types/generation";
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
  modelType?: ModelType;
  setModelType?: (type: ModelType) => void;
  showModelPreference?: boolean;
  visibility?: string;
  setVisibility?: (visibility: string) => void;
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
  setModelType = () => {},
  showModelPreference = false,
  visibility = "public",
  setVisibility = () => {}
}: GenerationFormProps) {
  return (
    <div className="p-0 space-y-0">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <GameTypeSelector 
          selectedType={gameType}
          onSelect={setGameType}
        />
      </div>
      
      <div className="p-6">
        <GamePromptInput 
          value={prompt}
          onChange={setPrompt}
          selectedType={gameType}
          onImageUploaded={onImageUploaded}
          onImageRemoved={onImageRemoved}
          imageUrl={imageUrl}
        />
      </div>
      
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            {/* Visibility toggle */}
            <div className="flex items-center gap-2">
              <Label htmlFor="visibility-toggle" className="text-sm text-gray-600 flex items-center gap-1">
                {visibility === "private" ? (
                  <>
                    <EyeOff size={14} className="text-gray-600" /> 
                    <span>Private</span>
                  </>
                ) : (
                  <>
                    <Eye size={14} className="text-gray-600" /> 
                    <span>Public</span>
                  </>
                )}
              </Label>
              <Switch 
                id="visibility-toggle" 
                checked={visibility === "private"}
                onCheckedChange={(checked) => setVisibility(checked ? "private" : "public")}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>
            
            {showModelPreference && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-600">Model:</Label>
                <Select value={modelType} onValueChange={setModelType}>
                  <SelectTrigger className="w-[150px] h-9 text-sm border-gray-200">
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
          
          <div className="flex items-center gap-3">
            {hasTerminalOutput && (
              <button
                onClick={showTerminalOutput}
                className="p-2.5 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors hover:border-gray-300 shadow-sm flex items-center justify-center"
                title="Show generation progress"
              >
                <Terminal size={18} className="text-gray-600" />
              </button>
            )}
            
            <button
              onClick={onGenerate}
              disabled={loading}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium shadow-md hover:shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
