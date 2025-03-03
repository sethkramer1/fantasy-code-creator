
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { Message } from "./types";

interface MessageItemProps {
  message: Message;
  onRevertToVersion?: (message: Message) => Promise<void>;
  gameVersions?: any[];
}

export const MessageItem = ({ message, onRevertToVersion, gameVersions = [] }: MessageItemProps) => {
  return (
    <div className="space-y-2">
      <div className="bg-blue-50 p-3 rounded-lg">
        <div className="flex justify-between items-start">
          <p className="text-blue-800">{message.message}</p>
          {message.model_type && (
            <span className="text-xs text-blue-500 ml-2 px-2 py-0.5 rounded-full bg-blue-100">
              {message.model_type === "smart" ? "Smartest" : "Fast"}
            </span>
          )}
        </div>
        {message.image_url && (
          <div className="mt-2 max-w-xs">
            <img 
              src={message.image_url} 
              alt="User uploaded image" 
              className="rounded-md max-h-48 object-contain"
            />
          </div>
        )}
        {onRevertToVersion && gameVersions.length > 1 && (
          <div className="mt-2">
            <Button
              variant="subtle"
              size="xs"
              className="flex items-center gap-1"
              onClick={() => onRevertToVersion(message)}
            >
              <RotateCcw size={12} />
              Revert to this version
            </Button>
          </div>
        )}
      </div>
      {message.response || message.isLoading ? (
        <div className="bg-gray-50 p-3 rounded-lg ml-4">
          {message.isLoading ? (
            <div className="flex items-center space-x-2">
              <Loader2 size={14} className="animate-spin text-gray-400" />
              <p className="text-gray-500">Processing request...</p>
            </div>
          ) : (
            <p className="text-gray-800">{message.response}</p>
          )}
        </div>
      ) : null}
    </div>
  );
};
