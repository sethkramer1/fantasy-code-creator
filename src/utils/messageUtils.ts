
import { Message } from "@/components/game-chat/types";

// Generate a placeholder message that follows the Message type
export const generatePlaceholderMessage = (initialPrompt: string): Message => {
  return {
    id: 'initial-message',
    message: initialPrompt,
    created_at: new Date().toISOString(),
    response: "Generating initial content..."
  };
};
