// Type definitions for Deno and EdgeRuntime
// These declarations are needed for TypeScript to recognize Deno and EdgeRuntime
// in Supabase Edge Functions

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    toObject(): { [key: string]: string };
  }
  
  export const env: Env;
}

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};
