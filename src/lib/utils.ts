
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Creates a function that can safely be used within the context of a Shadow DOM
 * to handle errors that might occur during script execution
 */
export function createShadowDOMErrorHandler(message: string) {
  return (error: Error) => {
    console.error(`${message}:`, error);
    // You could add more sophisticated error handling here
    // such as sending errors to a monitoring service
  };
}
