import { z } from "zod";

export const SearchKGSchema = z.object({
  query: z.string().describe("The search query in third person perspective"),
  validAt: z.string().optional().describe("The valid at time in ISO format"),
  startTime: z.string().optional().describe("The start time in ISO format"),
  endTime: z.string().optional().describe("The end time in ISO format"),
});

export const IngestKGSchema = z.object({
  data: z.string().describe("The data to ingest in text format"),
  source: z.string().describe("The source of the data"),
  referenceTime: z.string().describe("The reference time in ISO format"),
  sessionId: z.string().optional().describe("The session id of the conversation"),
});

export type SearchKG = z.infer<typeof SearchKGSchema>;
export type IngestKG = z.infer<typeof IngestKGSchema>;
