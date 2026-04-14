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
    ogImage?: string;
    generatedAt?: string;
    enrichedAt?: string;
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
  site?: string;
};

export type TechnicalOptions = {
  entities: EntityRecord[];
  site: string;
  output?: string;
  force?: boolean;
  maxLinks?: number;
};

export type EnrichOptions = {
  entities: EntityRecord[];
  apiKey?: string;
  output?: string;
  concurrency?: number;
  force?: boolean;
  dryRun?: boolean;
  maxRetries?: number;
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

// ── Optimize types ──────────────────────────────────────────

export type GSCCredentials = {
  type: "service_account" | "oauth";
  keyFilePath?: string;
  accessToken?: string;
};

export type GSCQueryRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GSCPageMetrics = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: GSCQueryRow[];
};

export type GSCFetchOptions = {
  site: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  accessToken?: string;
  dimensions?: string[];
};

export type GSCResponse = {
  rows: GSCQueryRow[];
  responseAggregationType?: string;
};

export type OptimizationIssueType =
  | "low_ctr"
  | "low_impressions"
  | "poor_position"
  | "striking_distance"
  | "high_impressions_low_clicks"
  | "intent_mismatch"
  | "weak_linking";

export type RecommendationType = "meta" | "content" | "structure" | "linking";

export type OptimizationRecommendation = {
  type: RecommendationType;
  action: string;
  reasoning: string;
};

export type OptimizationPriority = "critical" | "high" | "medium" | "low";

export type EntityOptimizationResult = {
  entity: string;
  slug: string;
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  optimizationScore: number;
  issues: string[];
  issueTypes: OptimizationIssueType[];
  recommendations: OptimizationRecommendation[];
  priority: OptimizationPriority;
};

export type OptimizationReport = {
  generatedAt: string;
  site: string;
  totalEntities: number;
  analyzedEntities: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    averageScore: number;
  };
  entities: EntityOptimizationResult[];
};

export type OptimizeOptions = {
  site: string;
  entities: EntityRecord[];
  limit?: number;
  autoFix?: boolean;
  output?: string;
  accessToken?: string;
  gscData?: GSCPageMetrics[];
};

// ── Blog types ──────────────────────────────────────────────

export type BlogOptions = {
  entities: EntityRecord[];
  output?: string;
  postsPerEntity?: number;
};

// ── Quality types ───────────────────────────────────────────

export type QualityOptions = {
  entities: EntityRecord[];
  contentDir?: string;
  output?: string;
};

// ── Keyword types ───────────────────────────────────────────

export type KeywordOptions = {
  entities: EntityRecord[];
  output?: string;
};

// ── Enriched content types ──────────────────────────────────

export type EnrichedSection = {
  heading: string;
  body: string;
};

export type EnrichedFaq = {
  question: string;
  answer: string;
};

export type EnrichedComparison = {
  entity: string;
  difference: string;
};

export type EnrichedContent = {
  slug: string;
  seo: {
    title: string;
    metaDescription: string;
    canonicalPath: string;
  };
  content: {
    intro: string;
    sections: EnrichedSection[];
    faqs: EnrichedFaq[];
    comparisons: EnrichedComparison[];
  };
  schema: {
    type: string;
    name: string;
    description: string;
  };
  warnings: string[];
};