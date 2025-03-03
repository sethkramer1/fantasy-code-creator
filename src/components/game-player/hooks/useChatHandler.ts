
import { useState } from "react";

export function useChatHandler() {
  const [chatLoading, setChatLoading] = useState(false);
  
  const handleChatSubmit = (message: string, image?: File | null) => {
    // Implementation of chat submission
    console.log("Chat message submitted:", message, image);
    // Add actual implementation as needed
  };
  
  return {
    chatLoading,
    handleChatSubmit
  };
}
