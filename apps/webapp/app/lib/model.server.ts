import { LLMMappings, LLMModelEnum } from "@recall/types";
import {
  type CoreMessage,
  type LanguageModelV1,
  generateText,
  streamText,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { logger } from "~/services/logger.service";

export async function makeModelCall(
  stream: boolean,
  model: LLMModelEnum,
  messages: CoreMessage[],
  onFinish: (text: string, model: string) => void,
  options?: any,
) {
  let modelInstance;
  let finalModel: string = "unknown";

  switch (model) {
    case LLMModelEnum.GPT35TURBO:
    case LLMModelEnum.GPT4TURBO:
    case LLMModelEnum.GPT4O:
    case LLMModelEnum.GPT41:
    case LLMModelEnum.GPT41MINI:
    case LLMModelEnum.GPT41NANO:
      finalModel = LLMMappings[model];
      modelInstance = openai(finalModel, { ...options });
      break;

    case LLMModelEnum.CLAUDEOPUS:
    case LLMModelEnum.CLAUDESONNET:
    case LLMModelEnum.CLAUDEHAIKU:
      finalModel = LLMMappings[model];
      break;

    case LLMModelEnum.GEMINI25FLASH:
    case LLMModelEnum.GEMINI25PRO:
    case LLMModelEnum.GEMINI20FLASH:
    case LLMModelEnum.GEMINI20FLASHLITE:
      finalModel = LLMMappings[model];
      break;

    default:
      logger.warn(`Unsupported model type: ${model}`);
      break;
  }

  if (stream) {
    return await streamText({
      model: modelInstance as LanguageModelV1,
      messages,
      onFinish: async ({ text }) => {
        onFinish(text, finalModel);
      },
    });
  }

  const { text } = await generateText({
    model: modelInstance as LanguageModelV1,
    messages,
  });

  onFinish(text, finalModel);

  return text;
}
