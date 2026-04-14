export { discover } from "./core/discover";
export { propose } from "./core/propose";
export { generate, loadEnrichedContent, renderYmylDisclaimer } from "./core/generate";
export { technical, buildSitemapIndex, buildBreadcrumbSchema } from "./core/technical";
export { enrich } from "./core/enrich";
export { teach } from "./core/teach";
export { audit } from "./core/audit";
export { classifyIntent } from "./core/intent";
export { getSections, renderSections } from "./core/sections";
export { scoreEntities } from "./core/score";
export { optimize } from "./core/optimize";
export { humanize, humanizeContent, countAiPatterns } from "./core/humanize";
export { scoreContent, scoreAllContent, fleschKincaid, trigramOverlap } from "./core/quality";
export { analyzeKeyword, analyzeKeywords, importKeywordData } from "./core/keywords";
export { blog, generateBlogOutlines } from "./core/blog";
export { buildFaqSchema } from "./core/technical";
export { diffGenerate } from "./core/diff";
export {
  fetchGSCData,
  buildMetricsFromRows,
  mapEntitiesToGSC,
  filterMappedEntities,
  filterUnmappedEntities,
  analyzeEntity,
  analyzeAll,
  calculateScore,
  generateRecommendations,
  applyAutoFixes,
  isSophonFile,
} from "./core/optimize";
export { nextjs } from "./adapters/nextjs";
export { astro } from "./adapters/astro";
export { nuxt } from "./adapters/nuxt";
export { sveltekit } from "./adapters/sveltekit";
export { remix } from "./adapters/remix";
export type {
  EntityRecord,
  DiscoverResult,
  DiscoverOptions,
  ProposeOptions,
  ProposeResult,
  ProposedEntity,
  ProposedEntityIntent,
  ProposedEntityAction,
  GenerateOptions,
  TechnicalOptions,
  EnrichOptions,
  GenerateSummary,
  ScoreCheck,
  EntityScore,
  ScoreResult,
  AuditCheck,
  AuditResult,
  Framework,
  DiscoverMode,
  GSCCredentials,
  GSCQueryRow,
  GSCPageMetrics,
  GSCFetchOptions,
  GSCResponse,
  OptimizationIssueType,
  RecommendationType,
  OptimizationRecommendation,
  OptimizationPriority,
  EntityOptimizationResult,
  OptimizationReport,
  OptimizeOptions,
  BlogOptions,
  QualityOptions,
  KeywordOptions,
  EnrichedContent,
  EnrichedSection,
  EnrichedFaq,
  EnrichedComparison,
} from "./types";
export type { KeywordData, KeywordDifficulty, KeywordImportRow } from "./core/keywords";
export { DEFAULT_PATTERNS } from "./core/discover";
export { slugify, stableHash, gradeFromScore, safeJsonStringify, assertSafePath } from "./core/utils";