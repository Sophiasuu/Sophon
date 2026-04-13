export { discover } from "./core/discover";
export { propose } from "./core/propose";
export { generate } from "./core/generate";
export { technical } from "./core/technical";
export { enrich } from "./core/enrich";
export { teach } from "./core/teach";
export { audit } from "./core/audit";
export { classifyIntent } from "./core/intent";
export { getSections, renderSections } from "./core/sections";
export { scoreEntities } from "./core/score";
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
} from "./types";
export { DEFAULT_PATTERNS } from "./core/discover";
export { slugify, stableHash, gradeFromScore } from "./core/utils";