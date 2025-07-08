import { logger } from "@trigger.dev/sdk/v3";
import axios from "axios";

// Memory API functions using axios interceptor
export interface SearchMemoryParams {
  query: string;
  validAt?: string;
  startTime?: string;
  endTime?: string;
}

export interface AddMemoryParams {
  message: string;
  referenceTime?: string;
  source?: string;
  spaceId?: string;
  sessionId?: string;
  metadata?: any;
}

export const searchMemory = async (params: SearchMemoryParams) => {
  try {
    const response = await axios.post("https://core::memory/search", params);
    return response.data;
  } catch (error) {
    logger.error("Memory search failed", { error, params });
    return { error: "Memory search failed" };
  }
};

export const addMemory = async (params: AddMemoryParams) => {
  try {
    // Set defaults for required fields
    const memoryInput = {
      ...params,
      episodeBody: params.message,
      referenceTime: params.referenceTime || new Date().toISOString(),
      source: params.source || "CORE",
    };

    const response = await axios.post(
      "https://core::memory/ingest",
      memoryInput,
    );
    return response.data;
  } catch (error) {
    logger.error("Memory storage failed", { error, params });
    return { error: "Memory storage failed" };
  }
};
