export enum EpisodeType {
  Message = "message",
  Code = "code",
  Documentation = "documentation",
}

export interface AddEpisodeParams {
  name: string;
  episodeBody: string;
  sourceDescription: string;
  referenceTime: Date;
  source?: EpisodeType;
  userId?: string;
  uuid?: string;
}

export interface AddEpisodeResult {
  episodeUuid: string;
  nodesCreated: number;
  edgesCreated: number;
  processingTimeMs: number;
}

export interface EntityNode {
  uuid: string;
  name: string;
  type: string;
  attributes?: Record<string, any>;
  nameEmbedding?: number[];
  createdAt: Date;
  userId?: string;
}

export interface EntityEdge {
  uuid: string;
  source: string; // source node uuid
  target: string; // target node uuid
  relationship: string;
  fact: string;
  factEmbedding?: number[];
  validAt: Date;
  invalidAt?: Date;
  isValid: boolean;
  episodes: string[]; // episode uuids where this edge was mentioned
  userId?: string;
}

export interface EpisodicNode {
  uuid: string;
  name: string;
  content: string;
  sourceDescription: string;
  source: EpisodeType;
  createdAt: Date;
  validAt: Date;
  entityEdges: string[]; // edge uuids
  userId?: string;
}
