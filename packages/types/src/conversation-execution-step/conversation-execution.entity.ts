export enum ActionStatusEnum {
  ACCEPT = "ACCEPT",
  DECLINE = "DECLINE",
  QUESTION = "QUESTION",
  TOOL_REQUEST = "TOOL_REQUEST",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export const ActionStatus = {
  ACCEPT: "ACCEPT",
  DECLINE: "DECLINE",
  QUESTION: "QUESTION",
  TOOL_REQUEST: "TOOL_REQUEST",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
};

export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];
