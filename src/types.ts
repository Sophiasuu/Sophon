export type DiscoverMode = "csv" | "seed";

export type EntityRecord = {
  id: string;
  name: string;
  slug: string;
  source: DiscoverMode;
  seedKeyword?: string;
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];
    attributes?: Record<string, string>;
  };
};

export type DiscoverResult = {
  generatedAt: string;
  mode: DiscoverMode;
  entityCount: number;
  entities: EntityRecord[];
};

export type Framework = "nextjs" | "astro" | "nuxt" | "sveltekit" | "remix";

export type DiscoverOptions = {
  csv?: string;
  seed?: string;
  output?: string;
  titleTemplate?: string;
  patterns?: string[];
};

export type GenerateOptions = {
  entities: EntityRecord[];
  framework: Framework;
  output?: string;
  template?: string;
  force?: boolean;
};

export type TechnicalOptions = {
  entities: EntityRecord[];
  site: string;
  output?: string;
  force?: boolean;
};

export type EnrichOptions = {
  entities: EntityRecord[];
  apiKey?: string;
  output?: string;
};

export type GenerateSummary = {
  total: number;
  generated: number;
  warnings: string[];
  todos: number;
};