
import { Loader2, Terminal, Wand2, Image as ImageIcon } from "lucide-react";
import { GameTypeSelector } from "./GameTypeSelector";
import { GamePromptInput } from "./GamePromptInput";
import { ImageUpload } from "./ImageUpload";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const [isEnhancing, setIsEnhancing] = useState(false);
  const { toast } = useToast();

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    
    setIsEnhancing(true);
    
    try {
      // Log the request for debugging
      console.log('Enhancing prompt:', { prompt, contentType: gameType });
      
      const { data, error } = await supabase.functions.invoke('enhance-prompt', {
        body: { 
          prompt: prompt,
          contentType: gameType 
        },
      });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Failed to enhance prompt: ${error.message}`);
      }
      
      console.log('Enhanced prompt response:', data);
      
      if (data?.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
        toast({
          title: "Prompt enhanced",
          description: "Your prompt has been improved with AI"
        });
      } else {
        throw new Error('Invalid response from enhance prompt function');
      }
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      toast({
        title: "Couldn't enhance prompt",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsEnhancing(false);
    }
  };
  
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
        />
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <ImageUpload
              onImageUploaded={onImageUploaded}
              onImageRemoved={onImageRemoved}
              imageUrl={imageUrl}
            />
          </div>
          
          <div>
            {prompt.trim().length > 0 && (
              <button 
                onClick={handleEnhancePrompt}
                disabled={isEnhancing}
                className="flex items-center gap-2 py-2 px-4 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                title="Enhance your prompt with AI"
              >
                <Wand2 size={16} className={isEnhancing ? "animate-spin" : ""} />
                <span className="font-medium">{isEnhancing ? "Enhancing..." : "Enhance prompt"}</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onGenerate}
            disabled={loading}
            className="flex-1 py-3 px-6 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-medium shadow-md hover:shadow-lg focus-ring"
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
              className="p-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors hover:border-blue-200 shadow-sm focus-ring"
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
