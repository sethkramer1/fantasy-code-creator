
import { useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
}

export function ImageUpload({ onImageUploaded, onImageRemoved }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('temp_uploads')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('temp_uploads')
        .getPublicUrl(filePath);

      setPreview(URL.createObjectURL(file));
      onImageUploaded(publicUrl);

    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onImageRemoved();
  };

  return (
    <div className="inline-flex items-center gap-2">
      {preview ? (
        <div className="relative">
          <img 
            src={preview} 
            alt="Upload preview" 
            className="h-6 w-6 object-cover rounded"
          />
          <button
            onClick={handleRemoveImage}
            className="absolute -top-1 -right-1 p-0.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ) : (
        <label className="cursor-pointer">
          {uploading ? (
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-gray-500 hover:text-gray-700 transition-colors" />
          )}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
            }}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
