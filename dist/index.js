"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  DEFAULT_PATTERNS: () => DEFAULT_PATTERNS,
  astro: () => astro,
  audit: () => audit,
  classifyIntent: () => classifyIntent,
  discover: () => discover,
  enrich: () => enrich,
  generate: () => generate,
  getSections: () => getSections,
  gradeFromScore: () => gradeFromScore,
  nextjs: () => nextjs,
  nuxt: () => nuxt,
  propose: () => propose,
  remix: () => remix,
  renderSections: () => renderSections,
  scoreEntities: () => scoreEntities,
  slugify: () => slugify,
  stableHash: () => stableHash,
  sveltekit: () => sveltekit,
  teach: () => teach,
  technical: () => technical
});
module.exports = __toCommonJS(src_exports);

// src/core/discover.ts
var import_promises = require("fs/promises");

// src/core/utils.ts
function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}
function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
}
function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

// src/core/discover.ts
var DEFAULT_PATTERNS = [
  "{seed} for startups",
  "{seed} for small business",
  "{seed} for enterprises",
  "{seed} pricing",
  "{seed} alternatives",
  "best {seed}",
  "{seed} comparison"
];
function resolvePatterns(patterns) {
  return patterns && patterns.length > 0 ? patterns : DEFAULT_PATTERNS;
}
function buildEntityId(name) {
  return stableHash(slugify(name));
}
function buildTitle(name, source, titleTemplate) {
  const fallbackTemplate = source === "seed" ? "{name} pages and comparisons" : "{name} overview and entity details";
  return (titleTemplate ?? fallbackTemplate).replaceAll("{name}", name);
}
function buildDescription(name, source, seedKeyword) {
  if (source === "seed" && seedKeyword) {
    return `Programmatic SEO placeholder content for ${name}, expanded from the seed keyword ${seedKeyword}.`;
  }
  return `Programmatic SEO placeholder content for ${name}.`;
}
function toEntity(name, source, options = {}) {
  const cleanName = name.trim();
  return {
    id: buildEntityId(cleanName),
    name: cleanName,
    slug: slugify(cleanName),
    source,
    seedKeyword: options.seedKeyword,
    metadata: {
      title: buildTitle(cleanName, source, options.titleTemplate),
      description: buildDescription(cleanName, source, options.seedKeyword),
      tags: options.seedKeyword ? [options.seedKeyword] : [],
      attributes: options.attributes
    }
  };
}
function dedupeEntities(entities) {
  const seen = /* @__PURE__ */ new Set();
  return entities.filter((entity) => {
    if (seen.has(entity.slug)) {
      return false;
    }
    seen.add(entity.slug);
    return true;
  });
}
function parseCsvRow(line) {
  const columns = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      columns.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  columns.push(current.trim());
  return columns.filter(Boolean);
}
function isHeaderRow(columns) {
  return columns.some((column) => /name|entity|keyword/i.test(column));
}
function buildAttributes(headers, columns) {
  const attributes = columns.slice(1).reduce((result, value, index) => {
    const key = headers[index + 1] ?? `column_${index + 2}`;
    result[key] = value;
    return result;
  }, {});
  return Object.keys(attributes).length > 0 ? attributes : void 0;
}
async function discoverFromCsv(csvPath, titleTemplate) {
  const raw = await (0, import_promises.readFile)(csvPath, "utf8");
  const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length === 0) {
    return [];
  }
  const firstRowColumns = parseCsvRow(rows[0]);
  const hasHeader = isHeaderRow(firstRowColumns);
  const headers = hasHeader ? firstRowColumns.map((column, index) => slugify(column).replace(/-/g, "_") || `column_${index + 1}`) : firstRowColumns.map((_column, index) => `column_${index + 1}`);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const entities = dataRows.flatMap((line) => {
    const columns = parseCsvRow(line);
    const name = columns[0];
    if (!name) {
      return [];
    }
    return [
      toEntity(name, "csv", {
        titleTemplate,
        attributes: buildAttributes(headers, columns)
      })
    ];
  });
  return dedupeEntities(entities);
}
function discoverFromSeed(seedKeyword, patternTemplates, titleTemplate) {
  const normalizedSeed = seedKeyword.trim();
  const placeholderEntities = patternTemplates.map((template) => template.replaceAll("{seed}", normalizedSeed));
  return dedupeEntities(
    placeholderEntities.map(
      (value) => toEntity(value, "seed", {
        seedKeyword: normalizedSeed,
        titleTemplate
      })
    )
  );
}
async function discover(options) {
  if (!options.csv && !options.seed) {
    throw new Error("Provide either a csv path or a seed keyword.");
  }
  const entities = options.csv ? await discoverFromCsv(options.csv, options.titleTemplate) : discoverFromSeed(options.seed, resolvePatterns(options.patterns), options.titleTemplate);
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    mode: options.csv ? "csv" : "seed",
    entityCount: entities.length,
    entities
  };
}

// src/core/intent.ts
var INTENT_RULES = [
  {
    intent: "commercial",
    pattern: /pricing|cost|price|plans|quote|buy|purchase/i,
    priority: 92,
    confidence: 0.9,
    reason: "Strong buying-intent modifier detected."
  },
  {
    intent: "comparison",
    pattern: /alternatives|comparison|vs\b|compare|versus/i,
    priority: 88,
    confidence: 0.86,
    reason: "Evaluation-intent modifier detected."
  },
  {
    intent: "segmented",
    pattern: /for startups|for small business|for enterprises|for agencies|for ecommerce|for teams/i,
    priority: 80,
    confidence: 0.82,
    reason: "Audience-segment modifier detected."
  },
  {
    intent: "informational",
    pattern: /what is|how to|guide|checklist|template|tutorial|examples/i,
    priority: 70,
    confidence: 0.75,
    reason: "Top-of-funnel informational modifier detected."
  }
];
function classifyIntent(name) {
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(name)) {
      return {
        intent: rule.intent,
        priority: rule.priority,
        confidence: rule.confidence,
        reason: rule.reason,
        action: rule.priority >= 85 ? "keep" : "review"
      };
    }
  }
  return {
    intent: "informational",
    priority: 65,
    confidence: 0.68,
    reason: "No explicit high-intent modifier detected; keep for topical coverage.",
    action: "review"
  };
}

// src/core/propose.ts
var DEFAULT_LIMIT = 40;
var EXTRA_PATTERNS = [
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
  "{seed} implementation"
];
function normalizePatterns(patterns) {
  const base = patterns && patterns.length > 0 ? patterns : DEFAULT_PATTERNS;
  return [...base, ...EXTRA_PATTERNS];
}
function toProposedEntity(seed, query) {
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
    action: scored.action
  };
}
function propose(options) {
  if (!options.seed || options.seed.trim().length === 0) {
    throw new Error("--seed is required for propose.");
  }
  const seed = options.seed.trim();
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const templates = normalizePatterns(options.patterns);
  const entities = templates.map((template) => template.replaceAll("{seed}", seed)).map((query) => toProposedEntity(seed, query)).filter((entity) => entity.slug.length > 0).sort((left, right) => right.priority - left.priority || right.confidence - left.confidence).filter((entity, index, list) => list.findIndex((candidate) => candidate.slug === entity.slug) === index).slice(0, limit);
  const groupedByIntent = {
    commercial: 0,
    comparison: 0,
    segmented: 0,
    informational: 0
  };
  for (const entity of entities) {
    groupedByIntent[entity.intent] += 1;
  }
  return {
    generatedBy: "SOPHON GENERATED PROPOSALS",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    seed,
    totalProposed: entities.length,
    groupedByIntent,
    entities
  };
}

// src/core/generate.ts
var import_promises2 = require("fs/promises");
var import_node_path = __toESM(require("path"));

// src/adapters/astro.ts
function astro(_options) {
  return `---
// SOPHON GENERATED
// Do not invent statistics, prices, comparisons, or factual claims
// All TODO sections must be filled with grounded sourced content
// Review YMYL warnings before publishing

const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
};
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{entity.title}</title>
    <meta name="description" content={entity.description} />
    <link rel="canonical" href={\`/\${entity.slug}\`} />
    <!-- Open Graph -->
    <meta property="og:title" content={entity.title} />
    <meta property="og:description" content={entity.description} />
    <meta property="og:url" content={\`/\${entity.slug}\`} />
    <meta property="og:type" content="website" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={entity.title} />
    <meta name="twitter:description" content={entity.description} />
  </head>
  <body>
    <main>
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
      <!-- Sophon intent: __ENTITY_INTENT__ -->
__ENTITY_SECTIONS__
      <pre>{JSON.stringify({ tags: entity.tags, attributes: entity.attributes }, null, 2)}</pre>
    </main>
  </body>
</html>
`;
}

// src/adapters/nextjs.ts
function nextjs(_options) {
  return `// SOPHON GENERATED
// Do not invent statistics, prices, comparisons, or factual claims
// All TODO sections must be filled with grounded sourced content
// Review YMYL warnings before publishing

import type { Metadata } from "next";

const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
} as const;

export const metadata: Metadata = {
  title: entity.title,
  description: entity.description,
  alternates: {
    canonical: "/" + entity.slug,
  },
  openGraph: {
    title: entity.title,
    description: entity.description,
    url: "/" + entity.slug,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: entity.title,
    description: entity.description,
  },
};

export const dynamic = "force-static";

export default function SophonPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-16">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Sophon generated page \xB7 __ENTITY_INTENT__ intent</p>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-950">{entity.title}</h1>
        <p className="max-w-3xl text-base leading-7 text-neutral-700">{entity.description}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-8 rounded-3xl border border-neutral-200 p-8">
__ENTITY_SECTIONS__
        </article>

        <aside className="space-y-6 rounded-3xl bg-neutral-50 p-8">
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-neutral-950">Tags</h2>
            <pre className="overflow-x-auto rounded-2xl bg-white p-4 text-sm text-neutral-700">{JSON.stringify(entity.tags, null, 2)}</pre>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium text-neutral-950">Attributes</h2>
            <pre className="overflow-x-auto rounded-2xl bg-white p-4 text-sm text-neutral-700">{JSON.stringify(entity.attributes, null, 2)}</pre>
          </div>
        </aside>
      </section>
    </main>
  );
}
`;
}

// src/adapters/nuxt.ts
function nuxt(_options) {
  return `<!-- SOPHON GENERATED -->
<!-- Do not invent statistics, prices, comparisons, or factual claims -->
<!-- All TODO sections must be filled with grounded sourced content -->
<!-- Review YMYL warnings before publishing -->

<script setup lang="ts">
const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
} as const;

definePageMeta({
  layout: "default",
});

useHead({
  title: entity.title,
  meta: [
    { name: "description", content: entity.description },
    { property: "og:title", content: entity.title },
    { property: "og:description", content: entity.description },
    { property: "og:url", content: "/" + entity.slug },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: entity.title },
    { name: "twitter:description", content: entity.description },
  ],
  link: [{ rel: "canonical", href: "/" + entity.slug }],
});
</script>

<template>
  <main>
    <h1>{{ entity.title }}</h1>
    <p>{{ entity.description }}</p>
    <!-- Sophon intent: __ENTITY_INTENT__ -->
__ENTITY_SECTIONS__
    <pre>{{ JSON.stringify({ tags: entity.tags, attributes: entity.attributes }, null, 2) }}</pre>
  </main>
</template>
`;
}

// src/adapters/remix.ts
function remix(_options) {
  return `// SOPHON GENERATED
// Do not invent statistics, prices, comparisons, or factual claims
// All TODO sections must be filled with grounded sourced content
// Review YMYL warnings before publishing

import type { MetaFunction } from "@remix-run/node";

const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
} as const;

export const meta: MetaFunction = () => {
  return [
    { title: entity.title },
    { name: "description", content: entity.description },
    { tagName: "link", rel: "canonical", href: "/" + entity.slug },
    { property: "og:title", content: entity.title },
    { property: "og:description", content: entity.description },
    { property: "og:url", content: "/" + entity.slug },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: entity.title },
    { name: "twitter:description", content: entity.description },
  ];
};

export default function SophonPage() {
  return (
    <main>
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
      {/* Sophon intent: __ENTITY_INTENT__ */}
__ENTITY_SECTIONS__
      <pre>{JSON.stringify({ tags: entity.tags, attributes: entity.attributes }, null, 2)}</pre>
    </main>
  );
}
`;
}

// src/adapters/sveltekit-page.ts
function buildSvelteKitPageModule() {
  return `export const prerender = true;

const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
} as const;

export function load() {
  return {
    entity,
  };
}
`;
}

// src/adapters/sveltekit.ts
function sveltekit(_options) {
  return `<!-- SOPHON GENERATED -->
<!-- Do not invent statistics, prices, comparisons, or factual claims -->
<!-- All TODO sections must be filled with grounded sourced content -->
<!-- Review YMYL warnings before publishing -->

<script lang="ts">
  export let data: {
    entity: {
      name: string;
      slug: string;
      title: string;
      description: string;
      tags: string[];
      attributes: Record<string, string>;
    };
  };
</script>

<svelte:head>
  <title>{data.entity.title}</title>
  <meta name="description" content={data.entity.description} />
  <link rel="canonical" href={\`/\${data.entity.slug}\`} />
  <!-- Open Graph -->
  <meta property="og:title" content={data.entity.title} />
  <meta property="og:description" content={data.entity.description} />
  <meta property="og:url" content={\`/\${data.entity.slug}\`} />
  <meta property="og:type" content="website" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={data.entity.title} />
  <meta name="twitter:description" content={data.entity.description} />
</svelte:head>

<main>
  <h1>{data.entity.title}</h1>
  <p>{data.entity.description}</p>

  <!-- Sophon intent: __ENTITY_INTENT__ -->

__ENTITY_SECTIONS__

  <pre>{JSON.stringify({ tags: data.entity.tags, attributes: data.entity.attributes }, null, 2)}</pre>
</main>
`;
}

// src/core/sections.ts
var COMMERCIAL_SECTIONS = [
  { heading: "Pricing Overview", placeholder: "Add verified pricing tiers, plans, and costs. Do not invent prices." },
  { heading: "Key Features", placeholder: "List core features with factual descriptions. Link to official sources." },
  { heading: "Who Is This For?", placeholder: "Describe the ideal customer profile and primary use cases." },
  { heading: "Get Started", placeholder: "Add a clear call-to-action: free trial, demo request, or signup link." }
];
var COMPARISON_SECTIONS = [
  { heading: "Side-by-Side Comparison", placeholder: "Build a factual comparison table. Only include verified differences." },
  { heading: "Pros & Cons", placeholder: "List evidence-based advantages and disadvantages for each option." },
  { heading: "Best For", placeholder: "Recommend which option suits which audience or use case." },
  { heading: "Verdict", placeholder: "Provide an objective summary. Do not make unsupported claims." }
];
var SEGMENTED_SECTIONS = [
  { heading: "Pain Points", placeholder: "Describe the specific challenges this audience faces." },
  { heading: "Tailored Use Cases", placeholder: "Show how the solution addresses this segment's specific needs." },
  { heading: "Success Stories", placeholder: "Add real case studies or testimonials. Do not fabricate quotes." },
  { heading: "Next Steps", placeholder: "Provide a segment-specific call-to-action." }
];
var INFORMATIONAL_SECTIONS = [
  { heading: "What You Need to Know", placeholder: "Write a comprehensive introduction to the topic." },
  { heading: "Step-by-Step Guide", placeholder: "Break down the process into clear, actionable steps." },
  { heading: "Frequently Asked Questions", placeholder: "Add sourced FAQ content. Validate all answers." },
  { heading: "Related Resources", placeholder: "Link to authoritative external and internal resources." }
];
var SECTIONS_BY_INTENT = {
  commercial: COMMERCIAL_SECTIONS,
  comparison: COMPARISON_SECTIONS,
  segmented: SEGMENTED_SECTIONS,
  informational: INFORMATIONAL_SECTIONS
};
function getSections(intent) {
  return SECTIONS_BY_INTENT[intent];
}
function renderWithIndent(sections, indent, gap, tailwind) {
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);
  if (tailwind) {
    return sections.map(
      (s) => `${pad}<section className="space-y-3 rounded-3xl bg-amber-50 p-6">
${inner}<h2 className="text-xl font-medium text-neutral-950">TODO: ${s.heading}</h2>
${inner}<p className="text-neutral-700">${s.placeholder}</p>
${pad}</section>`
    ).join(gap);
  }
  return sections.map(
    (s) => `${pad}<section>
${inner}<h2>TODO: ${s.heading}</h2>
${inner}<p>${s.placeholder}</p>
${pad}</section>`
  ).join(gap);
}
function renderSections(framework, sections) {
  switch (framework) {
    case "nextjs":
      return renderWithIndent(sections, 10, "\n\n", true);
    case "sveltekit":
      return renderWithIndent(sections, 2, "\n\n", false);
    case "remix":
      return renderWithIndent(sections, 6, "\n", false);
    case "astro":
      return renderWithIndent(sections, 6, "\n", false);
    case "nuxt":
      return renderWithIndent(sections, 4, "\n", false);
  }
}

// src/core/generate.ts
var YMYL_TERMS = [
  "health",
  "medical",
  "legal",
  "law",
  "financial",
  "investment",
  "tax",
  "insurance",
  "medication",
  "therapy",
  "mental health"
];
var TODO_SECTIONS_PER_PAGE = 4;
var COMMENT_BLOCKS = {
  nextjs: [
    "// SOPHON GENERATED",
    "// Do not invent statistics, prices, comparisons, or factual claims",
    "// All TODO sections must be filled with grounded sourced content",
    "// Review YMYL warnings before publishing",
    ""
  ].join("\n"),
  remix: [
    "// SOPHON GENERATED",
    "// Do not invent statistics, prices, comparisons, or factual claims",
    "// All TODO sections must be filled with grounded sourced content",
    "// Review YMYL warnings before publishing",
    ""
  ].join("\n"),
  astro: [
    "<!-- SOPHON GENERATED -->",
    "<!-- Do not invent statistics, prices, comparisons, or factual claims -->",
    "<!-- All TODO sections must be filled with grounded sourced content -->",
    "<!-- Review YMYL warnings before publishing -->",
    ""
  ].join("\n"),
  nuxt: [
    "<!-- SOPHON GENERATED -->",
    "<!-- Do not invent statistics, prices, comparisons, or factual claims -->",
    "<!-- All TODO sections must be filled with grounded sourced content -->",
    "<!-- Review YMYL warnings before publishing -->",
    ""
  ].join("\n"),
  sveltekit: [
    "<!-- SOPHON GENERATED -->",
    "<!-- Do not invent statistics, prices, comparisons, or factual claims -->",
    "<!-- All TODO sections must be filled with grounded sourced content -->",
    "<!-- Review YMYL warnings before publishing -->",
    ""
  ].join("\n")
};
var ADAPTERS = {
  nextjs,
  astro,
  nuxt,
  sveltekit,
  remix
};
function defaultOutputRoot(framework) {
  switch (framework) {
    case "nextjs":
      return "app";
    case "astro":
      return import_node_path.default.join("src", "pages");
    case "nuxt":
      return "pages";
    case "sveltekit":
      return import_node_path.default.join("src", "routes");
    case "remix":
      return import_node_path.default.join("app", "routes");
  }
}
function countPopulatedMetadataFields(entity) {
  return [
    entity.metadata.title,
    entity.metadata.description,
    entity.metadata.tags && entity.metadata.tags.length > 0 ? "tags" : void 0,
    entity.metadata.attributes && Object.keys(entity.metadata.attributes).length > 0 ? "attributes" : void 0
  ].filter(Boolean).length;
}
function isYmylEntity(entity) {
  const haystack = [entity.name, entity.seedKeyword ?? "", ...entity.metadata.tags ?? []].join(" ").toLowerCase();
  return YMYL_TERMS.some((term) => haystack.includes(term));
}
function buildHydrationMap(entity) {
  return {
    "__ENTITY_NAME__": JSON.stringify(entity.name),
    "__ENTITY_SLUG__": JSON.stringify(entity.slug),
    "__ENTITY_TITLE__": JSON.stringify(entity.metadata.title ?? entity.name),
    "__ENTITY_DESCRIPTION__": JSON.stringify(entity.metadata.description ?? `Explore ${entity.name}.`),
    "__ENTITY_TAGS__": JSON.stringify(entity.metadata.tags ?? []),
    "__ENTITY_ATTRIBUTES__": JSON.stringify(entity.metadata.attributes ?? {}, null, 2)
  };
}
function hydrateTemplate(template, entity, framework) {
  const intent = classifyIntent(entity.name).intent;
  const sections = getSections(intent);
  const replacements = {
    ...buildHydrationMap(entity),
    "__ENTITY_SECTIONS__": renderSections(framework, sections),
    "__ENTITY_INTENT__": intent
  };
  return template.replace(/__ENTITY_[A-Z_]+__/g, (match) => {
    return Object.hasOwn(replacements, match) ? replacements[match] : match;
  });
}
function buildFrameworkTemplate(options, entity) {
  return ADAPTERS[options.framework]({
    ...options,
    entities: [entity]
  });
}
function buildMainPagePath(framework, outputRoot, slug) {
  switch (framework) {
    case "nextjs":
      return import_node_path.default.join(outputRoot, slug, "page.tsx");
    case "astro":
      return import_node_path.default.join(outputRoot, `${slug}.astro`);
    case "nuxt":
      return import_node_path.default.join(outputRoot, `${slug}.vue`);
    case "sveltekit":
      return import_node_path.default.join(outputRoot, slug, "+page.svelte");
    case "remix":
      return import_node_path.default.join(outputRoot, `${slug}.tsx`);
  }
}
function buildAdditionalFiles(framework, outputRoot, entity) {
  if (framework !== "sveltekit") {
    return [];
  }
  return [
    {
      filePath: import_node_path.default.join(outputRoot, entity.slug, "+page.ts"),
      content: hydrateTemplate(buildSvelteKitPageModule(), entity, framework)
    }
  ];
}
function prependCommentBlock(framework, content) {
  return `${COMMENT_BLOCKS[framework]}${content}`;
}
function isManagedBySophon(content) {
  return content.includes("SOPHON GENERATED") || content.includes("Sophon generated");
}
async function writeGeneratedFile(filePath, content, options = {}) {
  if (!options.force) {
    try {
      const existing = await (0, import_promises2.readFile)(filePath, "utf8");
      if (!isManagedBySophon(existing)) {
        console.warn(
          `Skipping existing file already in place: ${filePath} (use --force to overwrite).`
        );
        return false;
      }
    } catch {
    }
  }
  await (0, import_promises2.mkdir)(import_node_path.default.dirname(filePath), { recursive: true });
  await (0, import_promises2.writeFile)(filePath, content, "utf8");
  console.log(`Generated file -> ${filePath}`);
  return true;
}
async function generate(options) {
  const outputRoot = options.output ?? defaultOutputRoot(options.framework);
  const customTemplate = options.template ? await (0, import_promises2.readFile)(options.template, "utf8") : void 0;
  const seenSlugs = /* @__PURE__ */ new Set();
  const warnings = [];
  let generated = 0;
  for (const entity of options.entities) {
    if (seenSlugs.has(entity.slug)) {
      const warning = `Duplicate slug skipped: ${entity.slug}`;
      warnings.push(warning);
      console.warn(warning);
      continue;
    }
    seenSlugs.add(entity.slug);
    if (isYmylEntity(entity)) {
      const warning = `YMYL topic detected for ${entity.slug}: review before publishing`;
      warnings.push(warning);
      console.warn(warning);
    }
    if (countPopulatedMetadataFields(entity) < 3) {
      const warning = `Thin content risk for ${entity.slug}: consider enriching metadata`;
      warnings.push(warning);
      console.warn(warning);
    }
    const template = customTemplate ?? buildFrameworkTemplate(options, entity);
    const pageContent = customTemplate ? prependCommentBlock(options.framework, hydrateTemplate(template, entity, options.framework)) : hydrateTemplate(template, entity, options.framework);
    const pagePath = buildMainPagePath(options.framework, outputRoot, entity.slug);
    const pageWritten = await writeGeneratedFile(pagePath, pageContent, {
      force: options.force
    });
    if (!pageWritten) {
      warnings.push(`Page skipped because existing implementation was detected: ${pagePath}`);
      continue;
    }
    for (const file of buildAdditionalFiles(options.framework, outputRoot, entity)) {
      await writeGeneratedFile(file.filePath, prependCommentBlock(options.framework, file.content), {
        force: options.force
      });
    }
    generated += 1;
  }
  const summary = {
    total: options.entities.length,
    generated,
    warnings,
    todos: generated * TODO_SECTIONS_PER_PAGE
  };
  console.log(`Total entities processed: ${summary.total}`);
  console.log(`Pages generated: ${summary.generated}`);
  console.log(`Warnings: ${summary.warnings.length}`);
  console.log(`TODOs remaining: ${summary.todos}`);
  return summary;
}

// src/core/technical.ts
var import_node_path2 = __toESM(require("path"));
function todayDate() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function buildSitemap(siteUrl, entities) {
  const lastmod = todayDate();
  const urls = entities.map(
    (entity) => `  <url>
    <loc>${siteUrl}/${entity.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
  ).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    ""
  ].join("\n");
}
function buildRobots(siteUrl) {
  return [
    "# Sophon generated \u2014 review before deploying to production",
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    ""
  ].join("\n");
}
function inferSchemaType(entity) {
  const category = (entity.metadata.attributes?.category ?? "").toLowerCase();
  if (category.includes("software") || category.includes("app")) {
    return "SoftwareApplication";
  }
  if (category.includes("local") || category.includes("business")) {
    return "LocalBusiness";
  }
  if (category.includes("product")) {
    return "Product";
  }
  return "WebPage";
}
function buildSchema(siteUrl, entities) {
  return entities.map((entity) => ({
    "@context": "https://schema.org",
    "@type": inferSchemaType(entity),
    name: entity.metadata.title ?? entity.name,
    description: entity.metadata.description ?? `SEO landing page for ${entity.name}.`,
    url: `${siteUrl}/${entity.slug}`
  }));
}
function countSharedTags(left, right) {
  const leftTags = new Set((left.metadata.tags ?? []).map((tag) => tag.toLowerCase()));
  return (right.metadata.tags ?? []).reduce((count, tag) => {
    return leftTags.has(tag.toLowerCase()) ? count + 1 : count;
  }, 0);
}
function relatedScore(entity, candidate) {
  let score = 0;
  if (entity.seedKeyword && candidate.seedKeyword && entity.seedKeyword === candidate.seedKeyword) {
    score += 3;
  }
  score += countSharedTags(entity, candidate) * 2;
  return score;
}
function buildHreflang(siteUrl, entities) {
  const lines = [
    "# SOPHON GENERATED \u2014 Hreflang scaffold",
    '# Add one <link rel="alternate"> block per language/region variant per entity.',
    "# See: https://developers.google.com/search/docs/specialty/international/localization",
    "#",
    "# Example for a single entity (paste into your <head>):",
    "#",
    ...entities.slice(0, 3).map(
      (e) => [
        `# <!-- ${e.name} -->`,
        `# <link rel="alternate" hreflang="en" href="${siteUrl}/${e.slug}" />`,
        `# <link rel="alternate" hreflang="x-default" href="${siteUrl}/${e.slug}" />`,
        `# <!-- Add hreflang="de", "fr", etc. for each language variant -->`,
        "#"
      ].join("\n")
    ),
    `# Total entities requiring hreflang coverage: ${entities.length}`,
    ""
  ].join("\n");
  return lines;
}
function buildInternalLinks(entities) {
  return entities.map((entity) => ({
    entity: entity.slug,
    relatedEntities: entities.filter((candidate) => candidate.slug !== entity.slug).map((candidate) => ({
      slug: candidate.slug,
      score: relatedScore(entity, candidate)
    })).filter((candidate) => candidate.score > 0).sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug)).slice(0, 3).map((candidate) => candidate.slug)
  }));
}
async function technical(options) {
  const outputRoot = options.output ?? "public";
  const siteUrl = options.site.replace(/\/$/, "");
  const technicalRoot = import_node_path2.default.join(outputRoot, "sophon");
  const sitemap = buildSitemap(siteUrl, options.entities);
  const robots = buildRobots(siteUrl);
  const schema = buildSchema(siteUrl, options.entities);
  const internalLinks = buildInternalLinks(options.entities);
  const hreflang = buildHreflang(siteUrl, options.entities);
  await Promise.all([
    writeGeneratedFile(import_node_path2.default.join(outputRoot, "sitemap.xml"), sitemap, {
      force: options.force
    }),
    writeGeneratedFile(import_node_path2.default.join(outputRoot, "robots.txt"), robots, {
      force: options.force
    }),
    writeGeneratedFile(import_node_path2.default.join(technicalRoot, "schema.json"), `${JSON.stringify(schema, null, 2)}
`, {
      force: options.force
    }),
    writeGeneratedFile(
      import_node_path2.default.join(technicalRoot, "internal-links.json"),
      `${JSON.stringify(internalLinks, null, 2)}
`,
      {
        force: options.force
      }
    ),
    writeGeneratedFile(import_node_path2.default.join(technicalRoot, "hreflang.txt"), hreflang, {
      force: options.force
    })
  ]);
  console.log(`sitemap.xml -> ${options.entities.length} URLs`);
  console.log(`schema.json -> ${schema.length} records`);
  console.log(`internal-links.json -> ${internalLinks.length} nodes`);
  console.log(`hreflang.txt -> ${options.entities.length} entity scaffolds`);
}

// src/core/enrich.ts
var import_node_path3 = __toESM(require("path"));
var import_sdk = __toESM(require("@anthropic-ai/sdk"));
var MODEL = "claude-sonnet-4-20250514";
var SYSTEM_PROMPT = `You are a programmatic SEO content generator.
Generate structured page content for the provided entity.

Rules you must follow:
- Only use facts explicitly present in the entity metadata
- Never invent statistics, prices, ratings, dates, or company facts
- Never make comparative claims without grounded data
- If you lack data for a section return a TODO marker instead of inventing content
- For YMYL topics (health, legal, financial, medical) add a disclaimer field
- Vary language meaningfully across entities to avoid duplicate content signals
- Never generate superlatives (best, fastest, cheapest) without sourced evidence

Return only valid JSON in this exact shape, no markdown, no preamble:
{
  "slug": "",
  "seo": {
    "title": "",
    "metaDescription": "",
    "canonicalPath": ""
  },
  "content": {
    "intro": "",
    "sections": [{ "heading": "", "body": "" }],
    "faqs": [{ "question": "", "answer": "" }],
    "comparisons": [{ "entity": "", "difference": "" }]
  },
  "schema": {
    "type": "WebPage",
    "name": "",
    "description": ""
  },
  "warnings": []
}`;
function messageText(response) {
  return response.content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("").trim();
}
function buildUserPrompt(entity) {
  return JSON.stringify({ entity }, null, 2);
}
async function enrich(options) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for enrichment.");
  }
  const outputRoot = options.output ?? import_node_path3.default.join("data", "enriched");
  const client = new import_sdk.default({ apiKey });
  for (const entity of options.entities) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 3e3,
        stream: false,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(entity)
          }
        ]
      });
      const parsed = JSON.parse(messageText(response));
      await writeGeneratedFile(
        import_node_path3.default.join(outputRoot, entity.slug, "content.json"),
        `${JSON.stringify(parsed, null, 2)}
`
      );
    } catch (error) {
      console.error(`Enrichment failed for ${entity.slug}:`, error instanceof Error ? error.message : error);
    }
  }
}

// src/core/teach.ts
var import_promises3 = require("fs/promises");
var import_node_path4 = __toESM(require("path"));
var import_promises4 = require("readline/promises");
var import_node_process = require("process");
var VALID_FRAMEWORKS = ["nextjs", "astro", "nuxt", "sveltekit", "remix"];
var VALID_ENTITY_SOURCES = ["seed", "csv", "existing"];
var VALID_AI_ANSWERS = ["yes", "no", "pending"];
async function askQuestion(rl, question, validator) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const answer = (await rl.question(question)).trim();
    if (!answer) {
      console.log("Please provide an answer.");
      continue;
    }
    if (validator && !validator(answer)) {
      console.log("Invalid answer. Please try again.");
      continue;
    }
    return answer;
  }
  throw new Error("Too many invalid attempts. Run `sophon teach` again.");
}
function formatContext(answers) {
  return `## Sophon Project Context

- **Niche**: ${answers.niche}
- **Site URL**: ${answers.siteUrl}
- **Framework**: ${answers.framework}
- **Content goal**: ${answers.contentGoal}
- **Target audience**: ${answers.targetAudience}
- **Differentiator**: ${answers.differentiator}
- **Entity source**: ${answers.entitySource}
- **AI enrichment**: ${answers.aiEnrichment}
`;
}
async function teach() {
  const rl = (0, import_promises4.createInterface)({ input: import_node_process.stdin, output: import_node_process.stdout });
  try {
    console.log("I'll ask a few quick questions so Sophon can work properly with your project.\n");
    console.log("--- Group 1: Project basics ---\n");
    const niche = await askQuestion(
      rl,
      '1. What is the niche or topic you want to build a programmatic SEO surface for?\n   (e.g. "best payroll software for small teams")\n   > '
    );
    const siteUrl = await askQuestion(
      rl,
      "\n2. What is your site's base URL? (e.g. https://mysite.com)\n   > ",
      (answer) => answer.startsWith("http://") || answer.startsWith("https://")
    );
    const framework = await askQuestion(
      rl,
      `
3. Which framework does your project use? (${VALID_FRAMEWORKS.join(", ")})
   > `,
      (answer) => VALID_FRAMEWORKS.includes(answer.toLowerCase())
    );
    console.log("\n--- Group 2: Content strategy ---\n");
    const contentGoal = await askQuestion(
      rl,
      "4. What is the goal of each generated page?\n   (e.g. rank for long-tail keywords, capture leads, drive free trial signups)\n   > "
    );
    const targetAudience = await askQuestion(
      rl,
      "\n5. Who is your target audience?\n   (e.g. HR managers at SMBs, freelance designers, e-commerce store owners)\n   > "
    );
    const differentiator = await askQuestion(
      rl,
      "\n6. What makes your offering different from what competitors rank for today?\n   > "
    );
    console.log("\n--- Group 3: Technical setup ---\n");
    const entitySource = await askQuestion(
      rl,
      `7. How will you source entities? (${VALID_ENTITY_SOURCES.join(" / ")})
   - seed: Sophon scaffolds entities from your niche
   - csv: You provide a file with entity names and attributes
   - existing: Use existing data/entities.json
   > `,
      (answer) => VALID_ENTITY_SOURCES.includes(answer.toLowerCase())
    );
    const aiEnrichment = await askQuestion(
      rl,
      `
8. Do you have an ANTHROPIC_API_KEY for AI content enrichment? (${VALID_AI_ANSWERS.join(" / ")})
   > `,
      (answer) => VALID_AI_ANSWERS.includes(answer.toLowerCase())
    );
    const answers = {
      niche,
      siteUrl: siteUrl.replace(/\/$/, ""),
      framework: framework.toLowerCase(),
      contentGoal,
      targetAudience,
      differentiator,
      entitySource: entitySource.toLowerCase(),
      aiEnrichment: aiEnrichment.toLowerCase()
    };
    const outputPath = import_node_path4.default.join(process.cwd(), ".sophon.md");
    await (0, import_promises3.writeFile)(outputPath, formatContext(answers), "utf8");
    console.log(`
Context saved to ${outputPath}`);
    console.log("Next step: use `sophon discover` to find entities, or `sophon run` to execute the full pipeline.");
  } finally {
    rl.close();
  }
}

// src/core/audit.ts
var import_promises5 = require("fs/promises");
var import_node_path5 = __toESM(require("path"));
var IGNORED_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", ".next", ".svelte-kit", ".nuxt"]);
async function exists(filePath) {
  try {
    await (0, import_promises5.access)(filePath);
    return true;
  } catch {
    return false;
  }
}
async function walkFiles(root) {
  const files = [];
  async function walk(current) {
    const entries = await (0, import_promises5.readdir)(current, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const fullPath = import_node_path5.default.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  await walk(root);
  return files;
}
async function hasPattern(files, pattern) {
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|astro|vue|svelte|mdx|html)$/i.test(file)) {
      continue;
    }
    try {
      const content = await (0, import_promises5.readFile)(file, "utf8");
      if (pattern.test(content)) {
        return true;
      }
    } catch {
    }
  }
  return false;
}
async function audit(options = {}) {
  const root = options.root ?? process.cwd();
  const files = await walkFiles(root);
  const checks = [
    {
      label: "Sitemap",
      implemented: await exists(import_node_path5.default.join(root, "public", "sitemap.xml")) || await exists(import_node_path5.default.join(root, "static", "sitemap.xml")) || await exists(import_node_path5.default.join(root, "sitemap.xml")),
      weight: 15,
      details: "Expected one of: public/sitemap.xml, static/sitemap.xml, sitemap.xml"
    },
    {
      label: "Robots",
      implemented: await exists(import_node_path5.default.join(root, "public", "robots.txt")) || await exists(import_node_path5.default.join(root, "static", "robots.txt")) || await exists(import_node_path5.default.join(root, "robots.txt")),
      weight: 10,
      details: "Expected one of: public/robots.txt, static/robots.txt, robots.txt"
    },
    {
      label: "Canonical tags",
      implemented: await hasPattern(files, /rel=["']canonical["']/i),
      weight: 20,
      details: 'Detected by rel="canonical" in page/head code'
    },
    {
      label: "Open Graph tags",
      implemented: await hasPattern(files, /og:title|openGraph/i),
      weight: 15,
      details: "Detected by og:* tags or openGraph metadata objects"
    },
    {
      label: "Twitter card tags",
      implemented: await hasPattern(files, /twitter:card|twitter\s*:\s*\{/i),
      weight: 10,
      details: "Detected by twitter:card tags or twitter metadata objects"
    },
    {
      label: "Structured data (JSON-LD)",
      implemented: await hasPattern(files, /application\/ld\+json|"@context"\s*:\s*"https:\/\/schema.org"/i),
      weight: 15,
      details: "Detected by JSON-LD script or schema.org context"
    },
    {
      label: "404 handling",
      implemented: await exists(import_node_path5.default.join(root, "app", "not-found.tsx")) || await exists(import_node_path5.default.join(root, "pages", "404.tsx")) || await exists(import_node_path5.default.join(root, "src", "routes", "+error.svelte")),
      weight: 5,
      details: "Detected common framework 404 conventions"
    },
    {
      label: "Redirect handling",
      implemented: await hasPattern(files, /redirects\s*\(|\[\[redirects\]\]|statusCode\s*:\s*301/i),
      weight: 10,
      details: "Detected common redirect config patterns"
    }
  ];
  const implemented = checks.filter((check) => check.implemented);
  const missing = checks.filter((check) => !check.implemented);
  const score = implemented.reduce((sum, check) => sum + check.weight, 0);
  const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
  const normalizedScore = Math.round(score / maxScore * 100);
  const grade = gradeFromScore(normalizedScore);
  console.log("Sophon SEO audit");
  console.log(`Already in place: ${implemented.length}/${checks.length}`);
  for (const check of implemented) {
    console.log(`  \u2713 ${check.label} (+${check.weight})`);
  }
  if (missing.length > 0) {
    console.log("\nRecommended next additions:");
    for (const check of missing) {
      console.log(`  \u2717 ${check.label} (${check.weight} pts available)`);
      if (check.details) {
        console.log(`    hint: ${check.details}`);
      }
    }
  }
  console.log(`
SEO score: ${score}/${maxScore} \u2014 ${normalizedScore}/100 (${grade})`);
  return { score, maxScore, grade, checks };
}

// src/core/score.ts
function scoreEntity(entity) {
  const checks = [];
  let total = 0;
  const hasTitle = !!entity.metadata.title && entity.metadata.title.length > 10;
  checks.push({ label: "Title present and meaningful", points: hasTitle ? 20 : 0, maxPoints: 20, passed: hasTitle });
  total += hasTitle ? 20 : 0;
  const hasDesc = !!entity.metadata.description && entity.metadata.description.length > 20;
  checks.push({ label: "Description present and meaningful", points: hasDesc ? 20 : 0, maxPoints: 20, passed: hasDesc });
  total += hasDesc ? 20 : 0;
  const hasTags = (entity.metadata.tags?.length ?? 0) >= 1;
  checks.push({ label: "At least one tag", points: hasTags ? 10 : 0, maxPoints: 10, passed: hasTags });
  total += hasTags ? 10 : 0;
  const hasAttrs = Object.keys(entity.metadata.attributes ?? {}).length >= 1;
  checks.push({ label: "At least one attribute", points: hasAttrs ? 10 : 0, maxPoints: 10, passed: hasAttrs });
  total += hasAttrs ? 10 : 0;
  const cleanSlug = entity.slug.length > 0 && !entity.slug.includes("--") && entity.slug.length <= 80;
  checks.push({ label: "Clean URL-safe slug", points: cleanSlug ? 10 : 0, maxPoints: 10, passed: cleanSlug });
  total += cleanSlug ? 10 : 0;
  const { confidence } = classifyIntent(entity.name);
  const highConfidence = confidence >= 0.82;
  checks.push({ label: "High-confidence intent", points: highConfidence ? 15 : 5, maxPoints: 15, passed: highConfidence });
  total += highConfidence ? 15 : 5;
  const wordCount = entity.name.split(/\s+/).length;
  const specific = wordCount >= 3;
  checks.push({ label: "Specific entity name (3+ words)", points: specific ? 15 : 5, maxPoints: 15, passed: specific });
  total += specific ? 15 : 5;
  return {
    slug: entity.slug,
    name: entity.name,
    score: total,
    grade: gradeFromScore(total),
    checks
  };
}
function scoreEntities(entities) {
  const scored = entities.map(scoreEntity);
  const avg = scored.length > 0 ? Math.round(scored.reduce((sum, e) => sum + e.score, 0) / scored.length) : 0;
  return {
    entityCount: scored.length,
    averageScore: avg,
    averageGrade: gradeFromScore(avg),
    entities: scored
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PATTERNS,
  astro,
  audit,
  classifyIntent,
  discover,
  enrich,
  generate,
  getSections,
  gradeFromScore,
  nextjs,
  nuxt,
  propose,
  remix,
  renderSections,
  scoreEntities,
  slugify,
  stableHash,
  sveltekit,
  teach,
  technical
});
//# sourceMappingURL=index.js.map