import { Spec } from "./oauth";

export enum IntegrationPayloadEventType {
  /**
   * When a webhook is received, this event is triggered to identify which integration
   * account the webhook belongs to
   */
  IDENTIFY_WEBHOOK_ACCOUNT = "identify_webhook_account",

  /**
   * Lifecycle events for integration accounts
   */
  INTEGRATION_ACCOUNT_CREATED = "integration_account_created",

  /**
   * When data is received from the integration source (e.g. new Slack message)
   */
  INTEGRATION_DATA_RECEIVED = "integration_data_received",

  /**
   * For integrations without webhook support, this event is triggered at the
   * configured frequency to sync data
   */
  SCHEDULED_SYNC = "scheduled_sync",
}

export interface IntegrationEventPayload {
  event: IntegrationPayloadEventType;
  [x: string]: any;
}

export interface Activity {
  id: string;
  type: string;
  timestamp: string;
  data: any;
}

export interface IntegrationAccountConfig {
  access_token: string;
  team_id?: string;
  channel_ids?: string;
  [key: string]: any;
}

export interface IntegrationAccountIdentifier {
  identifier: string;
  type: string;
}

export interface IntegrationAccountSettings {
  [key: string]: any;
}

export type MessageType =
  | "Spec"
  | "Activity"
  | "IntegrationAccountConfig"
  | "IntegrationAccountIdentifier"
  | "IntegrationAccountSettings";

export interface Message {
  type: MessageType;
  data:
    | Spec
    | Activity
    | IntegrationAccountConfig
    | IntegrationAccountIdentifier
    | IntegrationAccountSettings;
}
