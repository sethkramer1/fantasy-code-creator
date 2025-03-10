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
// Track recent toast messages to prevent duplicates
let recentToastMessages: {[key: string]: {timestamp: number, id: string}} = {};

const emitChange = () => {
  listeners.forEach(listener => listener(toasts));
};

// Module-level toast function that can be used anywhere
const toast = (props: Omit<Toast, "id">): string => {
  const id = Math.random().toString(36).substring(2, 9);
  
  // Create a key from the toast content to detect duplicates
  const toastKey = `${props.title || ''}-${props.description || ''}`;
  const now = Date.now();
  
  // Check if we've shown this toast recently (within 3 seconds)
  const recentToast = recentToastMessages[toastKey];
  if (recentToast && (now - recentToast.timestamp < 3000)) {
    // This is a duplicate toast - don't show it
    return recentToast.id;
  }
  
  // Add to recent toasts
  recentToastMessages[toastKey] = {
    timestamp: now,
    id
  };
  
  // Clean up old entries from recentToastMessages every 10 seconds
  if (Object.keys(recentToastMessages).length > 20) {
    const cutoffTime = now - 10000;
    recentToastMessages = Object.fromEntries(
      Object.entries(recentToastMessages).filter(([_, value]) => value.timestamp > cutoffTime)
    );
  }
  
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
