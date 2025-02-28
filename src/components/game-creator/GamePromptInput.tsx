
import { contentTypes } from "@/types/game";
import { useRef, useEffect, useState } from "react";
import { Image, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GamePromptInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedType: string;
  onImageUploaded?: (url: string) => void;
  onImageRemoved?: () => void;
  imageUrl?: string;
}

export function GamePromptInput({ 
  value, 
  onChange, 
  selectedType,
  onImageUploaded,
  onImageRemoved,
  imageUrl
}: GamePromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const { toast } = useToast();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  const getPlaceholder = () => {
    const type = contentTypes.find(t => t.id === selectedType);
    
    switch (selectedType) {
      case 'svg':
        return `Describe the SVG graphic you want to create...`;
      case 'webdesign':
        return `Describe the web design you want to create...`;
      case 'dataviz':
        return `Describe the data visualization you want to create...`;
      case 'diagram':
        return `Describe the diagram you want to create...`;
      case 'infographic':
        return `Describe the infographic you want to create...`;
      case 'game':
      default:
        return `Describe the game you want to create...`;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && onImageUploaded) {
        onImageUploaded(reader.result);
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your image",
        variant: "destructive"
      });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEnhancePrompt = async () => {
    if (!value.trim()) return;
    
    setIsEnhancing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enhance-prompt', {
        body: { 
          prompt: value,
          contentType: selectedType 
        },
      });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Failed to enhance prompt: ${error.message}`);
      }
      
      if (data?.enhancedPrompt) {
        onChange(data.enhancedPrompt);
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
    <div className="relative">
      <p className="font-medium text-gray-700 mb-3">Describe what you want</p>
      
      <div className="relative flex flex-col rounded-xl bg-white border border-gray-200 focus-within:border-black focus-within:ring-2 focus-within:ring-gray-100 transition-all shadow-sm">
        {/* Text input area */}
        <div className="flex-grow px-3 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full min-h-[120px] bg-transparent text-gray-800 placeholder:text-gray-400 resize-none focus:ring-0 focus:outline-none border-none focus:border-none"
            style={{ overflow: 'hidden' }}
          />
        </div>
        
        {/* Bottom controls area */}
        <div className="flex items-center px-3 py-2 space-x-2">
          {/* Image upload button */}
          <label className="flex items-center justify-center w-8 h-8 cursor-pointer hover:bg-gray-50 rounded-md transition-colors" title="Add an image reference">
            <Image size={20} className="text-gray-500" />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading || !!imageUrl}
            />
          </label>
          
          {/* Enhance prompt button - only shows when there's text */}
          {value.trim().length > 0 && (
            <button 
              onClick={handleEnhancePrompt}
              disabled={isEnhancing || !value.trim()}
              className="flex items-center justify-center w-8 h-8 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Enhance your prompt with AI"
            >
              <Wand2 size={20} className={`text-gray-500 ${isEnhancing ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>
      
      {/* Upload status indicator */}
      {isUploading && (
        <div className="mt-2 text-xs text-gray-500 animate-pulse">
          Uploading image...
        </div>
      )}
      
      {/* Show uploaded image preview */}
      {imageUrl && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">Image attached</div>
            <button
              onClick={onImageRemoved}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
