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

export type ProposedEntityIntent =
  | "commercial"
  | "comparison"
  | "segmented"
  | "informational";

export type ProposedEntityAction = "keep" | "review";

export type ProposedEntity = {
  id: string;
  name: string;
  slug: string;
  intent: ProposedEntityIntent;
  priority: number;
  confidence: number;
  reason: string;
  action: ProposedEntityAction;
};

export type ProposeOptions = {
  seed: string;
  patterns?: string[];
  limit?: number;
};

export type ProposeResult = {
  generatedBy: string;
  generatedAt: string;
  seed: string;
  totalProposed: number;
  groupedByIntent: Record<ProposedEntityIntent, number>;
  entities: ProposedEntity[];
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

export type ScoreCheck = {
  label: string;
  points: number;
  maxPoints: number;
  passed: boolean;
};

export type EntityScore = {
  slug: string;
  name: string;
  score: number;
  grade: string;
  checks: ScoreCheck[];
};

export type ScoreResult = {
  entityCount: number;
  averageScore: number;
  averageGrade: string;
  entities: EntityScore[];
};

export type AuditCheck = {
  label: string;
  implemented: boolean;
  weight: number;
  details?: string;
};

export type AuditResult = {
  score: number;
  maxScore: number;
  grade: string;
  checks: AuditCheck[];
};