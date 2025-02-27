
import { useState, useCallback } from "react";
import { Camera, FilePlus, Image, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
  imageUrl?: string;
}

export function ImageUpload({ onImageUploaded, onImageRemoved, imageUrl }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = useCallback(
    async (file: File) => {
      if (!file) return;

      try {
        setIsUploading(true);
        
        // Create a local URL for the image
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            onImageUploaded(reader.result);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Error uploading image:", error);
        toast({
          title: "Upload failed",
          description: "There was an error uploading your image.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [onImageUploaded, toast]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }
      uploadImage(file);
    }
  };

  const handleRemoveImage = () => {
    onImageRemoved();
  };

  return (
    <div className="w-full">
      {imageUrl ? (
        <div className="relative group">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
            <img
              src={imageUrl}
              alt="Uploaded image"
              className="object-contain max-h-full max-w-full"
            />
          </div>
          <button
            onClick={handleRemoveImage}
            className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1 rounded-full shadow-sm"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <label
            htmlFor="image-upload"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            <div className="rounded-md border border-gray-200 bg-white p-2 hover:bg-gray-50 transition-colors">
              <Image size={16} />
            </div>
            <span>Add an image reference</span>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>

          {isUploading && (
            <div className="animate-pulse text-sm text-gray-500">
              Uploading...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
