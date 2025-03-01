
import { useEffect, useState } from "react";

const TOAST_TIMEOUT = 8000; // 8 seconds instead of default 3 seconds

type ToastProps = {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

type Toast = ToastProps;

// Store for managing toasts outside of React components
let toasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

const emitChange = () => {
  listeners.forEach(listener => listener(toasts));
};

// Module-level toast function that can be used anywhere
const toast = (props: Omit<Toast, "id">): string => {
  const id = Math.random().toString(36).substring(2, 9);
  toasts = [...toasts, { id, ...props }];
  
  // Set timeout to remove the toast
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    emitChange();
  }, TOAST_TIMEOUT);
  
  emitChange();
  return id;
};

// Hook for React components
const useToast = () => {
  const [localToasts, setLocalToasts] = useState<Toast[]>(toasts);

  useEffect(() => {
    // Subscribe to changes
    listeners.push(setLocalToasts);
    
    return () => {
      // Unsubscribe on cleanup
      listeners = listeners.filter(listener => listener !== setLocalToasts);
    };
  }, []);

  const removeToast = (id: string) => {
    toasts = toasts.filter(t => t.id !== id);
    emitChange();
  };

  return {
    toasts: localToasts,
    toast,
    removeToast,
  };
};

export { useToast, toast };
