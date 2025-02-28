
import { Loader2, Terminal, Wand2 } from "lucide-react";
import { GameTypeSelector } from "./GameTypeSelector";
import { GamePromptInput } from "./GamePromptInput";
import { useState } from "react";

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
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setModelType("smart")}
              className={`relative p-3 rounded-xl border transition-all duration-200 hover-scale focus-ring ${
                modelType === "smart" 
                  ? 'border-gray-400 bg-black text-white shadow-md' 
                  : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  modelType === "smart" 
                    ? 'bg-white/20' 
                    : 'bg-gray-50 group-hover:bg-gray-100'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${modelType === "smart" ? 'text-white' : 'text-gray-700'}`}>
                    <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4Z"></path>
                    <circle cx="12" cy="14" r="2"></circle>
                    <path d="M12 12v0"></path>
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className={`font-medium ${modelType === "smart" ? 'text-white' : ''}`}>Smartest</h3>
                  <p className={`text-xs ${modelType === "smart" ? 'text-white/70' : 'text-gray-500'}`}>Higher quality, may take longer</p>
                </div>
              </div>
              
              {modelType === "smart" && (
                <div className="absolute inset-0 border-2 border-gray-400 rounded-xl pointer-events-none"></div>
              )}
            </button>
            
            <button
              onClick={() => setModelType("fast")}
              className={`relative p-3 rounded-xl border transition-all duration-200 hover-scale focus-ring ${
                modelType === "fast" 
                  ? 'border-gray-400 bg-black text-white shadow-md' 
                  : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  modelType === "fast" 
                    ? 'bg-white/20' 
                    : 'bg-gray-50 group-hover:bg-gray-100'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${modelType === "fast" ? 'text-white' : 'text-gray-700'}`}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className={`font-medium ${modelType === "fast" ? 'text-white' : ''}`}>Fastest</h3>
                  <p className={`text-xs ${modelType === "fast" ? 'text-white/70' : 'text-gray-500'}`}>Quick response, good quality</p>
                </div>
              </div>
              
              {modelType === "fast" && (
                <div className="absolute inset-0 border-2 border-gray-400 rounded-xl pointer-events-none"></div>
              )}
            </button>
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
