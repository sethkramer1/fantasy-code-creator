
import { contentTypes } from "@/types/game";

export const getSystemPrompt = (gameType: string): string => {
  const contentType = contentTypes.find(type => type.id === gameType) || contentTypes.find(type => type.id === 'game')!;
  
  return `You are an expert developer specializing in web technologies.
You are tasked with creating ${contentType.name.toLowerCase()} content based on the user's request.
Return only the complete HTML code that's ready to be displayed in a browser.
Include all CSS and JavaScript within the HTML file.
Do not include any explanations, markdown formatting or code blocks - only return the actual code.`;
};
