import { contentTypes } from "@/types/game";
import { useRef, useEffect, useState } from "react";
import { Image, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DesignStyleButtons } from "./DesignStyleButtons";

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
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null);
  const {
    toast
  } = useToast();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  // Handle paste events for automatically attaching images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!onImageUploaded) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            break;
          }
        }
      }
    };
    const textarea = textareaRef.current;
    textarea?.addEventListener('paste', handlePaste);
    return () => {
      textarea?.removeEventListener('paste', handlePaste);
    };
  }, [onImageUploaded]);

  const getPlaceholder = () => {
    const type = contentTypes.find(t => t.id === selectedType);
    switch (selectedType) {
      case 'svg':
        return `Describe what you'd like to create`;
      case 'webdesign':
        return `Describe what you'd like to create`;
      case 'dataviz':
        return `Describe what you'd like to create`;
      case 'diagram':
        return `Describe what you'd like to create`;
      case 'infographic':
        return `Describe what you'd like to create`;
      case 'game':
      default:
        return `Describe what you'd like to create`;
    }
  };

  const handleImageFile = (file: File) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImageFile(file);
  };

  const handleEnhancePrompt = async () => {
    if (!value.trim()) return;
    setIsEnhancing(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('enhance-prompt', {
        body: {
          prompt: value,
          contentType: selectedType,
          note: "The resulting code will be written in one single HTML, JavaScript, and CSS file, so keep the enhanced prompt realistic and implementable within that constraint."
        }
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

  const handleExampleSelected = (promptSnippet: string | null, styleId: string | null) => {
    // Store the active style ID
    setActiveStyleId(styleId);
    
    if (!promptSnippet) {
      // If no prompt snippet is provided, remove the design guidelines from the prompt
      const updatedPrompt = value.replace(/\n*DESIGN GUIDELINES:.*$/s, '').trim();
      onChange(updatedPrompt);
      
      toast({
        title: "Design style removed",
        description: "Design guidelines have been removed from your prompt"
      });
      return;
    }
    
    // Check if there's already a design guideline in the prompt
    const hasDesignGuidelines = value.includes("DESIGN GUIDELINES:");
    
    let updatedPrompt;
    if (hasDesignGuidelines) {
      // Replace the existing design guidelines
      updatedPrompt = value.replace(/DESIGN GUIDELINES:.*$/s, `DESIGN GUIDELINES: ${promptSnippet}`);
    } else {
      // Add new design guidelines
      updatedPrompt = value.trim() 
        ? `${value.trim()}\n\nDESIGN GUIDELINES: ${promptSnippet}`
        : `DESIGN GUIDELINES: ${promptSnippet}`;
    }
    
    onChange(updatedPrompt);
    
    toast({
      title: "Design style applied",
      description: "Design guidelines have been added to your prompt"
    });
  };

  return <div className="relative">
      <div className="relative flex flex-col rounded-xl bg-white border border-gray-200 focus-within:border-black focus-within:ring-2 focus-within:ring-gray-100 transition-all shadow-sm">
        {/* Text input area */}
        <div className="flex-grow px-3 pt-4 pb-2">
          <textarea ref={textareaRef} value={value} onChange={e => onChange(e.target.value)} placeholder={getPlaceholder()} className="w-full min-h-[120px] bg-transparent text-gray-800 placeholder:text-gray-400 resize-none focus:ring-0 focus:outline-none border-0 focus:border-0 outline-none" style={{
          overflow: 'hidden',
          outline: 'none',
          boxShadow: 'none'
        }} />
        </div>
        
        {/* Show uploaded image preview right below the input */}
        {imageUrl && <div className="px-3 pb-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm text-gray-500">Image attached for inspiration</div>
              <button onClick={onImageRemoved} className="text-xs text-gray-500 hover:text-gray-700 underline">
                Remove
              </button>
            </div>
            <div className="border border-gray-200 rounded-md overflow-hidden max-w-xs">
              <img src={imageUrl} alt="Attached image" className="max-w-full h-auto" />
            </div>
          </div>
        </div>}
        
        {/* Bottom controls area */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center space-x-2">
            {/* Image upload button */}
            <label className="flex items-center justify-center gap-2 px-3 h-8 cursor-pointer hover:bg-gray-50 rounded-md transition-colors" title="Add an image for inspiration">
              <Image size={20} className="text-gray-500" />
              <span className="text-gray-500 text-sm">Add Image for Inspiration</span>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading || !!imageUrl} />
            </label>
            
            {/* Enhance prompt button - only shows when there's text */}
            {value.trim().length > 0 && <button onClick={handleEnhancePrompt} disabled={isEnhancing || !value.trim()} className="flex items-center justify-center gap-2 px-3 h-8 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Enhance your prompt with AI">
                <Wand2 size={20} className={`text-gray-500 ${isEnhancing ? "animate-spin" : ""}`} />
                <span className="text-gray-500 text-sm">Enhance Prompt</span>
              </button>}
          </div>
        </div>
      </div>
      
      {/* Upload status indicator */}
      {isUploading && <div className="mt-2 text-xs text-gray-500 animate-pulse">
          Uploading image...
        </div>}
      
      {/* Design Style Buttons */}
      <DesignStyleButtons 
        onStyleSelected={handleExampleSelected} 
        activeStyleId={activeStyleId}
      />
    </div>;
}