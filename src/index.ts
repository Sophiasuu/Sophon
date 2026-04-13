export { discover } from "./core/discover";
export { generate } from "./core/generate";
export { technical } from "./core/technical";
export { enrich } from "./core/enrich";
export { audit } from "./core/audit";
export { nextjs } from "./adapters/nextjs";
export { astro } from "./adapters/astro";
export { nuxt } from "./adapters/nuxt";
export { sveltekit } from "./adapters/sveltekit";
export { remix } from "./adapters/remix";
export type {
  EntityRecord,
  DiscoverResult,
  DiscoverOptions,
  GenerateOptions,
  TechnicalOptions,
  EnrichOptions,
  GenerateSummary,
  Framework,
  DiscoverMode,
} from "./types";
export { DEFAULT_PATTERNS } from "./core/discover";