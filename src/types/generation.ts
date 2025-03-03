
import { contentTypes } from "./game";

export interface GenerationOptions {
  prompt: string;
  gameType: string;
  imageUrl?: string;
  existingGameId?: string;
  modelType?: ModelType;
}

export type ModelType = "smart" | "fast";

export interface GenerationState {
  loading: boolean;
  showTerminal: boolean;
  terminalOutput: string[];
  thinkingTime: number;
  gameId: string | null;
  modelType: ModelType;
}

export interface GenerationResult {
  id: string;
  prompt?: string;
  code?: string;
  instructions?: string;
  current_version?: number;
  type?: string;
  model_type?: string;
}

export interface ContentTypeInstructions {
  gameType: string;
  systemInstructions: string;
}

export interface GenerationHookResult extends GenerationState {
  setShowTerminal: (show: boolean) => void;
  setThinkingTime: (time: number) => void;
  generateGame: (options: GenerationOptions) => Promise<GenerationResult | null>;
  timerRef: React.MutableRefObject<NodeJS.Timeout | undefined>;
  setGameId: (id: string | null) => void;
  setModelType: (type: ModelType) => void;
}
