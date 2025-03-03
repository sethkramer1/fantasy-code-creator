
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { MessageItem } from "./MessageItem";
import { MessageListProps } from "./types";

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ messages, loadingHistory, onRevertToVersion, gameVersions = [] }, ref) => {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingHistory ? (
          <div className="flex justify-center">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-500">No messages yet. Ask me to modify!</p>
        ) : (
          messages.map(msg => (
            <MessageItem 
              key={msg.id} 
              message={msg} 
              onRevertToVersion={onRevertToVersion}
              gameVersions={gameVersions}
            />
          ))
        )}
        <div ref={ref} />
      </div>
    );
  }
);

MessageList.displayName = "MessageList";
