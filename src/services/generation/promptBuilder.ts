
import { contentTypes } from "@/types/game";

export const buildPrompt = (userPrompt: string, gameType: string) => {
  const contentType = contentTypes.find(type => type.id === gameType) || contentTypes.find(type => type.id === 'game')!;
  
  return `${contentType.promptPrefix}\n\n${userPrompt}\n\nPlease provide clean, well-structured HTML, CSS, and JavaScript code that runs in a modern browser. The code should be responsive and accessible.`;
};
