import { type Message } from "@core/types";

/**
 * Validates if a message has the correct structure
 * @param message - Message to validate
 * @returns True if valid, false otherwise
 */
export function isValidMessage(message: any): message is Message {
  return (
    typeof message === "object" &&
    message !== null &&
    typeof message.type === "string" &&
    message.data !== undefined &&
    ["spec", "activity", "state", "identifier", "account"].includes(
      message.type,
    )
  );
}

/**
 * Extracts and validates messages from CLI output
 * @param output - Raw CLI output string
 * @returns Array of valid messages
 */
export function extractMessagesFromOutput(output: string): Message[] {
  const messages: Message[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (isValidMessage(parsed)) {
        messages.push(parsed);
      }
    } catch (error) {
      // Line is not JSON, skip it
      continue;
    }
  }

  return messages;
}
