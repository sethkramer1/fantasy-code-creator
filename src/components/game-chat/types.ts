
export interface Message {
  id: string;
  game_id?: string;
  message: string;
  response?: string | null;
  created_at: string;
  image_url?: string | null;
  model_type?: "smart" | "fast" | null;
  isLoading?: boolean;
  is_system?: boolean;
}

export interface MessageItemProps {
  message: Message;
  onRevertToVersion?: (message: Message) => Promise<void>;
  gameVersions?: any[];
}

export interface MessageListProps {
  messages: Message[];
  loadingHistory?: boolean;
  onRevertToVersion?: (message: Message) => Promise<void>;
  gameVersions?: any[];
}

export interface GameChatProps {
  gameId: string;
  onGameUpdate: (newCode: string, newInstructions: string) => void;
  onTerminalStatusChange?: (showing: boolean, output: string[], thinking: number, isLoading: boolean) => void;
  disabled?: boolean;
  onRevertToVersion?: (message: Message) => Promise<void>;
  gameVersions?: any[];
  initialMessage?: string;
}
