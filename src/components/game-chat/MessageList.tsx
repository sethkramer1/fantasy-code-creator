
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { MessageItem } from "./MessageItem";
import { MessageListProps } from "./types";

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ messages, loadingHistory, onRevertToVersion, gameVersions = [] }, ref) => {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingHistory ? (
          <div className="flex justify-center my-8">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-gray-500 mb-2">No messages yet</p>
            <p className="text-sm text-gray-400">Ask me to modify the content!</p>
          </div>
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
