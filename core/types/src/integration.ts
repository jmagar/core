export enum IntegrationEventType {
  /**
   * Setting up or creating an integration account
   */
  SETUP = "setup",

  /**
   * Processing incoming data from the integration
   */
  PROCESS = "process",

  /**
   * Identifying which account a webhook belongs to
   */
  IDENTIFY = "identify",

  /**
   * Scheduled synchronization of data
   */
  SYNC = "sync",
}

export interface IntegrationEventPayload {
  event: IntegrationEventType;
  [x: string]: any;
}

export interface Spec {
  name: string;
  key: string;
  description: string;
  icon: string;
  mcp?: {
    command: string;
    args: string[];
    env: Record<string, string>;
  };
  auth?: {
    OAuth2?: {
      token_url: string;
      authorization_url: string;
      scopes: string[];
      scope_identifier?: string;
      scope_separator?: string;
    };
  };
}

export interface Config {
  access_token: string;
  [key: string]: any;
}

export interface Identifier {
  id: string;
  type?: string;
}

export type MessageType = 'spec' | 'data' | 'identifier';

export interface Message {
  type: MessageType;
  data: any;
}