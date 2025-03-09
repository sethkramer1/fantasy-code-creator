// Type declarations for Deno runtime APIs
declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): { [key: string]: string };
  }
  
  export const env: Env;
  
  export function exit(code?: number): never;
  
  export interface InspectOptions {
    colors?: boolean;
    depth?: number;
    iterableLimit?: number;
    showProxy?: boolean;
    sorted?: boolean;
    trailingComma?: boolean;
    getters?: boolean;
    showHidden?: boolean;
  }
  
  export function inspect(value: unknown, options?: InspectOptions): string;
}

// Type declarations for EdgeRuntime
declare namespace EdgeRuntime {
  export function waitUntil(promise: Promise<any>): void;
}

// Type declarations for DOMParser in Deno
declare class DOMParser {
  parseFromString(markup: string, type: string): Document;
}

// Type declarations for Document in Deno
interface Document {
  documentElement: HTMLElement;
  createElement(tagName: string): HTMLElement;
  getElementsByTagName(tagName: string): HTMLCollectionOf<HTMLElement>;
  head: HTMLElement;
  body: HTMLElement;
  querySelectorAll(selectors: string): NodeListOf<HTMLElement>;
}

// Type declarations for HTMLElement in Deno
interface HTMLElement {
  textContent: string | null;
  outerHTML: string;
  innerHTML: string;
  remove(): void;
  appendChild(node: HTMLElement): HTMLElement;
  rel?: string;
  href?: string;
  src?: string;
}

// Type declarations for HTMLCollectionOf in Deno
interface HTMLCollectionOf<T extends HTMLElement> {
  length: number;
  item(index: number): T | null;
  [index: number]: T;
}

// Type declarations for NodeListOf in Deno
interface NodeListOf<T extends Node> {
  length: number;
  item(index: number): T | null;
  forEach(callbackfn: (value: T, key: number, parent: NodeListOf<T>) => void, thisArg?: any): void;
  [index: number]: T;
}

// Type declarations for Node in Deno
interface Node {
  childNodes: NodeListOf<Node>;
  parentNode: Node | null;
}
