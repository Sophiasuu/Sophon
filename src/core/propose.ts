import { DEFAULT_PATTERNS } from "./discover";
import { classifyIntent } from "./intent";
import type {
  ProposedEntity,
  ProposedEntityIntent,
  ProposeOptions,
  ProposeResult,
} from "../types";

const DEFAULT_LIMIT = 40;

const EXTRA_PATTERNS = [
  "{seed} tools",
  "{seed} software",
  "{seed} for agencies",
  "{seed} for ecommerce",
  "{seed} checklist",
  "{seed} guide",
  "how to choose {seed}",
  "{seed} features",
  "{seed} examples",
  "{seed} template",
  "{seed} implementation",
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stableHash(value: string): string {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
}

function normalizePatterns(patterns?: string[]): string[] {
  const base = patterns && patterns.length > 0 ? patterns : DEFAULT_PATTERNS;
  return [...base, ...EXTRA_PATTERNS];
}

function toProposedEntity(seed: string, query: string): ProposedEntity {
  const cleanName = query.trim();
  const slug = slugify(cleanName);
  const scored = classifyIntent(cleanName);

  return {
    id: stableHash(slug),
    name: cleanName,
    slug,
    intent: scored.intent,
    priority: scored.priority,
    confidence: scored.confidence,
    reason: `${scored.reason} Seed: ${seed}.`,
    action: scored.action,
  };
}

export function propose(options: ProposeOptions): ProposeResult {
  if (!options.seed || options.seed.trim().length === 0) {
    throw new Error("--seed is required for propose.");
  }

  const seed = options.seed.trim();
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const templates = normalizePatterns(options.patterns);

  const entities = templates
    .map((template) => template.replaceAll("{seed}", seed))
    .map((query) => toProposedEntity(seed, query))
    .filter((entity) => entity.slug.length > 0)
    .sort((left, right) => right.priority - left.priority || right.confidence - left.confidence)
    .filter((entity, index, list) => list.findIndex((candidate) => candidate.slug === entity.slug) === index)
    .slice(0, limit);

  const groupedByIntent: Record<ProposedEntityIntent, number> = {
    commercial: 0,
    comparison: 0,
    segmented: 0,
    informational: 0,
  };

  for (const entity of entities) {
    groupedByIntent[entity.intent] += 1;
  }

  return {
    generatedBy: "SOPHON GENERATED PROPOSALS",
    generatedAt: new Date().toISOString(),
    seed,
    totalProposed: entities.length,
    groupedByIntent,
    entities,
  };
}
