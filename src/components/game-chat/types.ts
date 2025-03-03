import { ModelType } from "@/types/generation";

export interface Message {
  id: string;
  message: string;
  response?: string | null;
  created_at: string;
  version_id?: string | null;
  image_url?: string | null;
  model_type?: ModelType | null;
  isLoading?: boolean;
  game_id?: string;
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

export interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  imageUrl: string | null;
  setImageUrl: (url: string | null) => void;
  modelType: string;
  handleModelChange: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  disabled?: boolean;
}

export interface MessageListProps {
  messages: Message[];
  loadingHistory: boolean;
  onRevertToVersion?: (message: Message) => Promise<void>;
  gameVersions?: any[];
}

export interface MessageItemProps {
  message: Message;
  onRevertToVersion?: (message: Message) => Promise<void>;
  gameVersions?: any[];
}

export interface ImageUploadResult {
  fileInputRef: React.RefObject<HTMLInputElement>;
  isUploading: boolean;
  handleImageFile: (file: File) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  imagePreview: JSX.Element | null;
}

export interface ImageUploadProps {
  imageUrl: string | null;
  setImageUrl: (url: string | null) => void;
  disabled?: boolean;
}
