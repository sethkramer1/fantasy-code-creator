
import { GameChat } from "@/components/GameChat";
import { Message } from "@/components/game-chat/types";

interface SidebarChatProps {
  gameId?: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSubmit: (message: string, image?: File | null) => void;
  input: string;
  setInput: (input: string) => void;
  loading: boolean;
  disabled?: boolean;
  imageUrl: string | null;
  setImageUrl: (url: string | null) => void;
  modelType: string;
  handleModelChange: (value: string) => void;
  generationInProgress?: boolean;
  onGameUpdate?: (newCode: string, newInstructions: string) => void;
  onTerminalStatusChange?: (showing: boolean, output: string[], thinking: number, isLoading: boolean) => void;
  onRevertToMessageVersion?: (message: Message) => Promise<void>;
  gameVersions?: any[];
  initialPrompt?: string;
}

export function SidebarChat({
  gameId,
  isOpen,
  setIsOpen,
  onSubmit,
  input,
  setInput,
  loading,
  disabled = false,
  imageUrl,
  setImageUrl,
  modelType,
  handleModelChange,
  generationInProgress,
  onGameUpdate,
  onTerminalStatusChange,
  onRevertToMessageVersion,
  gameVersions,
  initialPrompt
}: SidebarChatProps) {
  // If this is the chat sidebar used in the Game player
  if (gameId && onGameUpdate && onTerminalStatusChange && onRevertToMessageVersion && gameVersions) {
    return (
      <div className="w-[380px] flex flex-col bg-white border-r border-gray-100">
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center">
            <h2 className="text-lg font-medium text-black">Modify Content</h2>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <GameChat 
            gameId={gameId} 
            onGameUpdate={onGameUpdate} 
            onTerminalStatusChange={onTerminalStatusChange}
            disabled={disabled || generationInProgress || false}
            onRevertToVersion={onRevertToMessageVersion}
            gameVersions={gameVersions}
            initialMessage={initialPrompt || ''}
          />
        </div>
      </div>
    );
  }
  
  // If this is the simpler chat sidebar with just message input/output
  return (
    <div className={`fixed inset-y-0 right-0 w-[350px] bg-white border-l border-gray-200 shadow-xl transform transition-transform duration-300 z-20 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Chat</h3>
          <p className="text-sm text-gray-500">Ask questions or request changes</p>
          
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">AI Model</label>
            <select 
              value={modelType}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="basic">Basic (Fast)</option>
              <option value="smart">Smart (Balanced)</option>
              <option value="advanced">Advanced (Powerful)</option>
            </select>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {/* Message list would go here */}
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) {
              onSubmit(input);
              setInput('');
            }
          }}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type a message..."
                disabled={loading || disabled}
              />
              <button
                type="submit"
                className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
                disabled={!input.trim() || loading || disabled}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
            
            {imageUrl && (
              <div className="mt-2 relative">
                <img src={imageUrl} alt="Upload" className="w-20 h-20 object-cover rounded" />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  onClick={() => setImageUrl(null)}
                >
                  ×
                </button>
              </div>
            )}
            
            {!imageUrl && (
              <button
                type="button"
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                onClick={() => {
                  // Image upload logic would go here
                }}
              >
                Add image
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
