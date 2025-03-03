
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadProps, ImageUploadResult } from "./types";

export const ImageUpload = ({ imageUrl, setImageUrl, disabled = false }: ImageUploadProps): ImageUploadResult => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageFile = (file: File) => {
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
      if (typeof reader.result === "string") {
        setImageUrl(reader.result);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImageFile(file);
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    fileInputRef,
    isUploading,
    handleImageFile,
    handleImageUpload,
    handleRemoveImage,
    imagePreview: imageUrl ? (
      <div className="mb-3 relative">
        <div className="relative rounded-lg overflow-hidden border border-gray-200 inline-flex max-w-xs">
          <img 
            src={imageUrl} 
            alt="Selected image" 
            className="max-h-48 object-contain"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute top-1 right-1 p-1 bg-white/90 rounded-full hover:bg-white transition-colors shadow-sm"
            disabled={disabled}
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>
      </div>
    ) : null
  };
};
