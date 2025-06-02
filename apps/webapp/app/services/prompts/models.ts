/**
 * Models for prompt system
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type PromptFunction = (context: Record<string, any>) => Message[];

export interface PromptVersion {
  [version: string]: (context: Record<string, any>) => Message[];
}
