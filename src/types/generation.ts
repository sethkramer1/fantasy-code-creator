
export interface GenerationOptions {
  prompt: string;
  gameType: string;
  imageUrl?: string;
  existingGameId?: string;
  modelType?: ModelType;
  visibility?: string;
}

export interface GenerationResult {
  id: string;
  [key: string]: any;
}

export type ModelType = 'smart' | 'fast';

export interface ContentTypeInstructions {
  systemInstructions: string;
  promptPrefix: string;
}
