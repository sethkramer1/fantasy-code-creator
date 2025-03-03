
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export function usePlayUI(gameVersionsLength: number) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modelType, setModelType] = useState<string>("smart");
  const [chatInput, setChatInput] = useState("");
  const { toast } = useToast();

  // Show toast when game versions are loaded
  useEffect(() => {
    if (gameVersionsLength > 0 && sidebarOpen === false) {
      toast({
        title: "Chat is available",
        description: "Click the chat icon to ask questions or request changes",
      });
    }
  }, [gameVersionsLength, sidebarOpen, toast]);

  // Mobile sidebar handler
  useEffect(() => {
    // Close sidebar when resizing to desktop if it was opened on mobile
    const handleResize = () => {
      if (window.innerWidth >= 1024 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

  const handleModelChange = (value: string) => {
    setModelType(value);
  };

  return {
    sidebarOpen,
    setSidebarOpen,
    showCode,
    setShowCode,
    imageUrl,
    setImageUrl,
    modelType,
    handleModelChange,
    chatInput, 
    setChatInput
  };
}
