
export interface GenerationOptions {
  prompt: string;
  gameType: string;
  imageUrl?: string;
  existingGameId?: string;
  modelType?: string;
  visibility?: string;
}

export interface GenerationResult {
  id: string;
  [key: string]: any;
}
