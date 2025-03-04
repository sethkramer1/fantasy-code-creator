import { Message } from "@/components/game-chat/types";

export const createSystemMessage = (messageText: string, responseText: string): Message => {
  return {
    id: crypto.randomUUID(),
    message: messageText,
    created_at: new Date().toISOString(),
    response: responseText,
    game_id: '',
    user_id: '',
    is_system: true,
    model_type: 'smart'
  };
};
