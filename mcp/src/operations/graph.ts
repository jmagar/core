import { SearchKG, IngestKG } from "../types/graph.js";
import axiosInstance from "../utils/axios-config.js";

export async function searchKnowledgeGraph(args: SearchKG) {
  const { query, ...rest } = args;
  const response = await axiosInstance.post(`/search`, {
    query,
    ...rest,
  });
  return response.data;
}

export async function ingestKnowledgeGraph(args: IngestKG) {
  const response = await axiosInstance.post(`/ingest`, {
    data: args.data,
    source: process.env.SOURCE,
    referenceTime: args.referenceTime,
    sessionId: args.sessionId ? args.sessionId : undefined,
  });
  return response.data;
}
