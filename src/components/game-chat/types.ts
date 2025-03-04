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
  version_id?: string | null; // Add this property for the version ID
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
  modelType?: "smart" | "fast";
}

export interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  imageUrl: string | null;
  setImageUrl: (url: string | null) => void;
  modelType: "smart" | "fast";
  handleModelChange: (value: "smart" | "fast") => void;
  handleSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  disabled?: boolean;
}

export interface ImageUploadProps {
  imageUrl: string | null;
  setImageUrl: (url: string | null) => void;
  disabled?: boolean;
}

export interface ImageUploadResult {
  fileInputRef: React.RefObject<HTMLInputElement>;
  isUploading: boolean;
  handleImageFile: (file: File) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  imagePreview: JSX.Element | null;
}
