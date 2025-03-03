
import React from "react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading game..." }: LoadingStateProps) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}
