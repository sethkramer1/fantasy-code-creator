
import { Wand2 } from "lucide-react";
import { contentTypes } from "@/types/game";
import { useRef, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface GamePromptInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedType: string;
}

export function GamePromptInput({ value, onChange, selectedType }: GamePromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const [isEnhancing, setIsEnhancing] = useState(false);

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
        return `Describe the SVG graphic you want to create. Be specific about:
- The type of graphic (logo, icon, illustration)
- Style and design elements
- Colors and shapes
- Size and proportions
- Any text or typography requirements`;
      case 'webdesign':
        return `Describe the web design you want to create. Be specific about:
- Purpose and target audience
- Layout and structure
- Color scheme and typography
- Key components and sections
- Responsive design requirements`;
      case 'dataviz':
        return `Describe the data visualization you want to create. Be specific about:
- Type of visualization (chart, graph, etc.)
- Data points and relationships to show
- Interactive features needed
- Color scheme and styling
- Labels and legends`;
      case 'diagram':
        return `Describe the diagram you want to create. Be specific about:
- Type of diagram (flowchart, sequence, etc.)
- Elements and connections
- Layout and direction
- Labels and annotations
- Color scheme and styling`;
      case 'infographic':
        return `Describe the infographic you want to create. Be specific about:
- Topic and main message
- Key data points or information
- Visual style and layout
- Icons and illustrations needed
- Text and typography`;
      case 'game':
      default:
        return `Describe the game you want to create. Be specific about:
- The type of game (platformer, puzzle, etc.)
- Core gameplay mechanics
- How the player controls the game
- Scoring or winning conditions
- Visual style and theme`;
    }
  };

  const handleEnhancePrompt = async () => {
    if (!value.trim()) return;
    
    setIsEnhancing(true);
    
    try {
      // Log the request for debugging
      console.log('Enhancing prompt:', { prompt: value, contentType: selectedType });
      
      const response = await fetch('/functions/v1/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: value,
          contentType: selectedType 
        }),
      });
      
      // Log the response for debugging
      console.log('Enhance prompt response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to enhance prompt: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Enhanced prompt:', data);
      
      if (data.enhancedPrompt) {
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
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={getPlaceholder()}
        className="w-full p-4 rounded-lg bg-white border border-gray-200 focus:ring-2 focus:ring-black/5 focus:outline-none transition-all text-gray-800 placeholder:text-gray-400 min-h-[48px] resize-none pr-20"
        style={{ height: 'auto', overflow: 'hidden' }}
      />
      {value.trim().length > 0 && (
        <div className="absolute right-3 top-3">
          <button 
            onClick={handleEnhancePrompt}
            disabled={isEnhancing}
            className="flex items-center gap-1.5 p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Enhance your prompt with AI"
          >
            <Wand2 size={16} className={isEnhancing ? "animate-spin" : ""} />
            <span className="text-sm">{isEnhancing ? "Enhancing..." : "Enhance prompt"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
