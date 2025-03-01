
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

const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {};

    toasts.forEach((toast) => {
      if (!timers[toast.id]) {
        timers[toast.id] = setTimeout(() => {
          setToasts((toasts) => toasts.filter((t) => t.id !== toast.id));
          delete timers[toast.id];
        }, TOAST_TIMEOUT);
      }
    });

    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, [toasts]);

  const addToast = (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((toasts) => [...toasts, { id, ...toast }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((toasts) => toasts.filter((t) => t.id !== id));
  };

  const toast = (props: Omit<Toast, "id">) => {
    return addToast(props);
  };

  return {
    toasts,
    toast,
    removeToast,
  };
};

export { useToast, toast };
