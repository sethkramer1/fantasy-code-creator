export interface Message {
  id: string;
  created_at: string;
  game_id: string;
  message: string;
  response: string;
  user_id: string;
  is_system: boolean;
  model_type: string;
  image_url?: string | null;
  version_id?: string | null;
  isLoading?: boolean;
}

export interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  imageUrl: string | null;
  setImageUrl: (url: string | null) => void;
  modelType: string;
  handleModelChange: (modelType: string) => void;
  handleSubmit: () => Promise<void>;
  loading: boolean;
  disabled: boolean;
}

export interface MessageListProps {
  messages: Message[];
  loadingHistory: boolean;
  onRevertToVersion?: (message: Message) => void;
  gameVersions?: GameVersion[];
  ref: React.RefObject<HTMLDivElement>;
  gameUserId?: string | null;
}

export interface MessageItemProps {
  message: Message;
  onRevertToVersion?: (message: Message) => void;
  gameVersions?: GameVersion[];
  gameUserId?: string | null;
}

export interface GameChatProps {
  gameId?: string;
  onGameUpdate?: (newCode: string, instructions: string) => Promise<void>;
  onTerminalStatusChange?: (running: boolean, showTerminal?: boolean) => void;
  disabled?: boolean;
  onRevertToVersion?: (message: Message) => void;
  gameVersions?: GameVersion[];
  initialMessage?: string;
  modelType?: ModelType;
  gameUserId?: string | null;
}

export type ModelType = "fast" | "smart";

export interface GameVersion {
  id: string;
  version_number: number;
  code: string;
  instructions: string | null;
  created_at: string;
}
