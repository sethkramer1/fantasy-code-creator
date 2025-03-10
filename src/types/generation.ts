
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

export interface TokenInfo {
  inputTokens: number;
  outputTokens: number;
}

export interface StreamCallbacks {
  onStreamStart?: () => void;
  onThinking?: (thinking: string) => void;
  onContent?: (content: string) => void;
  onError?: (error: Error) => void;
  onComplete?: (fullContent: string) => void;
  onTokenInfo?: (tokenInfo: TokenInfo) => void;
}

export interface StreamEvent {
  type: string;
  delta?: {
    text?: string;
    type?: 'text_delta' | 'thinking_delta';
    thinking?: string;
    stop_reason?: string;
  };
  content_block?: {
    text: string;
    type?: string;
  };
  thinking?: string;
  error?: {
    message: string;
    type?: string;
  };
  usage?: TokenInfo;
  token_usage?: TokenInfo;
}
