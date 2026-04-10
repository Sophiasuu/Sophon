export type DiscoverMode = "csv" | "seed";

export type EntityMetadata = {
  title?: string;
  description?: string;
  tags?: string[];
  attributes?: Record<string, string>;
};

export type EntityRecord = {
  id: string;
  name: string;
  slug: string;
  source: DiscoverMode;
  seedKeyword?: string;
  metadata: EntityMetadata;
};

export type DiscoverResult = {
  generatedAt: string;
  mode: DiscoverMode;
  entityCount: number;
  entities: EntityRecord[];
};