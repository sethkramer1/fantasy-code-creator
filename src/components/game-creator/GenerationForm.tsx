
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
  onImageRemoved
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
