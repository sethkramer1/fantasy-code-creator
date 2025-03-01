
export interface Message {
  id: string;
  message: string;
  response?: string | null;
  created_at: string;
  version_id?: string | null;
  image_url?: string | null;
  model_type?: string | null;
  isLoading?: boolean;
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
