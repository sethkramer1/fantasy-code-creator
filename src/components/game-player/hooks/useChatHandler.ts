
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useChatHandler() {
  const [chatLoading, setChatLoading] = useState(false);
  const { toast } = useToast();
  
  const handleChatSubmit = async (message: string, image?: File | null) => {
    if (!message.trim() && !image) {
      return;
    }
    
    setChatLoading(true);
    
    try {
      console.log("Submitting chat message:", message, image);
      
      // Here we would typically upload the image and send the message
      // to the backend for processing
      
      // Example implementation:
      // 1. If there's an image, upload it to storage
      let imageUrl: string | undefined;
      
      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `chat-images/${fileName}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('game-assets')
          .upload(filePath, image);
          
        if (uploadError) {
          throw new Error(`Error uploading image: ${uploadError.message}`);
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('game-assets')
          .getPublicUrl(filePath);
          
        imageUrl = publicUrl;
      }
      
      // 2. Process the message (this would connect to your AI service)
      // This is a placeholder - the actual implementation would depend on your backend
      
      // Success notification
      toast({
        title: "Message sent",
        description: image ? "Your message and image were sent successfully" : "Your message was sent successfully",
      });
      
    } catch (error) {
      console.error("Error sending chat message:", error);
      toast({
        title: "Error sending message",
        description: error instanceof Error ? error.message : "There was an error sending your message",
        variant: "destructive"
      });
    } finally {
      setChatLoading(false);
    }
  };
  
  return {
    chatLoading,
    handleChatSubmit
  };
}
