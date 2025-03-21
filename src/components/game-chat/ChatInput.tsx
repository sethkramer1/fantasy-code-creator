import { useRef, useEffect } from "react";
import { Loader2, ArrowUp, Paperclip, Info } from "lucide-react";
import { ImageUpload } from "./ImageUpload";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChatInputProps } from "./types";
import { ModelType } from "@/types/generation";

export const ChatInput = ({ 
  message, 
  setMessage, 
  imageUrl, 
  setImageUrl, 
  modelType, 
  handleModelChange, 
  handleSubmit, 
  loading, 
  disabled = false,
  disabledMessage
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { 
    fileInputRef,
    isUploading,
    handleImageFile,
    handleImageUpload,
    handleRemoveImage,
    imagePreview
  } = ImageUpload({ 
    imageUrl, 
    setImageUrl, 
    disabled 
  });

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (modelType !== "smart" || disabled) return;
      
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
  }, [modelType, disabled, handleImageFile]);

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 relative flex-shrink-0">
      {imagePreview}
      
      <div className={`bg-white rounded-xl shadow-sm p-4 border border-gray-100 ${disabled ? 'opacity-50' : ''}`}>
        <div className="relative">
          <textarea 
            ref={textareaRef}
            value={message} 
            onChange={e => setMessage(e.target.value)} 
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }} 
            placeholder={disabled ? "Chat is currently disabled" : "Request a change"} 
            className="w-full bg-transparent text-gray-800 border-none outline-none focus:outline-none focus:ring-0 focus:border-none focus:shadow-none resize-none min-h-[24px] max-h-[200px] py-0 px-0 placeholder-gray-400 !ring-0 !ring-offset-0 rounded-none" 
            disabled={loading || disabled}
            rows={1}
            style={{ boxShadow: 'none', borderRadius: '0' }}
          />
        </div>
        
        <div className="flex items-center justify-between mt-4 gap-2">
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 text-gray-600 transition-colors ${disabled ? 'pointer-events-none opacity-50' : ''}`}
              title="Select model"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <Info size={16} className="text-gray-400 hover:text-gray-600" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3 bg-white border border-gray-100 shadow-md">
                    <p>Choose the model that best fits your needs:</p>
                    <ul className="mt-2 text-sm list-disc pl-4 space-y-1">
                      <li><strong>Fastest</strong>: Ideal for small edits like color or text edits - 5x faster to iterate with good results.</li>
                      <li><strong>Smartest</strong>: Best results but takes longer to generate. Supports image uploads.</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Select
                value={modelType}
                onValueChange={handleModelChange}
                disabled={loading || disabled}
              >
                <SelectTrigger className="w-[160px] h-8 bg-white border-gray-200 text-sm">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">
                    <div className="flex items-center">
                      <span>Fastest</span>
                      <span className="ml-2 text-xs text-green-600 font-medium whitespace-nowrap">5x faster</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="smart">
                    <span>Smartest</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {modelType === "smart" && (
              <label
                className={`flex items-center gap-2 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                title="Attach image"
              >
                <Paperclip size={18} />
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={loading || isUploading || disabled}
                />
              </label>
            )}
          </div>
          
          <button 
            type="submit" 
            disabled={loading || (!message.trim() && !imageUrl) || isUploading || disabled} 
            className="h-8 w-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Send message"
          >
            {loading ? 
              <Loader2 className="animate-spin" size={14} /> : 
              <ArrowUp size={14} />
            }
          </button>
        </div>
        
        {isUploading && (
          <div className="mt-2 text-xs text-gray-500 animate-pulse">
            Uploading image...
          </div>
        )}
        
        {disabled && (
          <div className="mt-2 text-xs text-gray-500">
            {disabledMessage || "Chat is currently disabled"}
          </div>
        )}
      </div>
    </form>
  );
};
