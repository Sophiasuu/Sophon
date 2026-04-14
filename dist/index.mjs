// src/core/discover.ts
import { readFile } from "fs/promises";

// src/core/utils.ts
import path from "path";
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
function safeJsonStringify(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}
function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}
function assertSafePath(filePath) {
  const resolved = path.resolve(filePath);
  const cwd = process.cwd();
  if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
    throw new Error(`Output path must be within the project directory: ${filePath}`);
  }
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
var TITLE_TEMPLATES = [
  { pattern: /\bpricing\b/i, template: "{name}: Plans, Costs & What to Expect" },
  { pattern: /\balternatives\b/i, template: "Top {name} Worth Trying in {year}" },
  { pattern: /\bcomparison\b|\bvs\b/i, template: "{name}: Features, Pros & Cons" },
  { pattern: /\bbest\b/i, template: "{name}: Reviewed and Ranked ({year})" },
  { pattern: /\bfor\s/i, template: "{name}: Complete Guide ({year})" },
  { pattern: /\bhow to\b/i, template: "{name} - Step by Step" },
  { pattern: /\bguide\b|\bchecklist\b/i, template: "{name} ({year} Edition)" }
];
var GENERIC_TITLES = [
  "{name}: What You Need to Know ({year})",
  "{name} - A Practical Overview ({year})",
  "{name}: Guide and Key Insights ({year})"
];
function titleCase(text) {
  const minorWords = /* @__PURE__ */ new Set(["a", "an", "the", "and", "but", "or", "for", "in", "on", "at", "to", "of", "by", "is"]);
  return text.split(/\s+/).map((word, index) => {
    if (index === 0 || !minorWords.has(word.toLowerCase())) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.toLowerCase();
  }).join(" ");
}
function buildTitle(name, _source, titleTemplate) {
  if (titleTemplate) {
    return titleTemplate.replaceAll("{name}", titleCase(name));
  }
  const year = (/* @__PURE__ */ new Date()).getFullYear().toString();
  const matched = TITLE_TEMPLATES.find((t) => t.pattern.test(name));
  const template = matched?.template ?? GENERIC_TITLES[name.length % GENERIC_TITLES.length];
  let title = template.replaceAll("{name}", titleCase(name)).replaceAll("{year}", year);
  if (title.length > 65) {
    title = title.slice(0, 60).replace(/\s+\S*$/, "...");
  }
  return title;
}
function buildDescription(name, _source, seedKeyword) {
  const keyword = seedKeyword ? ` ${seedKeyword}` : "";
  const descriptions = [
    `Compare ${name} options and find the right${keyword} fit for your needs. Features, pricing, and honest reviews.`,
    `Everything you need to know about ${name}. Unbiased breakdown of features, use cases, and top picks for${keyword}.`,
    `Looking for the best ${name}? We cover key differences, real pros and cons, and practical recommendations.`
  ];
  let desc = descriptions[name.length % descriptions.length];
  if (desc.length > 160) {
    desc = desc.slice(0, 155).replace(/\s+\S*$/, "...");
  }
  return desc;
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
  const raw = await readFile(csvPath, "utf8");
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
    pattern: /pricing|cost|price|plans|quote|buy|purchase|deals?|coupon|discount|free trial/i,
    priority: 92,
    confidence: 0.9,
    reason: "Strong buying-intent modifier detected."
  },
  {
    intent: "comparison",
    pattern: /alternatives|comparison|vs\b|compare|versus|better than|switch(?:ing)?\s+from|replace|competitor/i,
    priority: 88,
    confidence: 0.86,
    reason: "Evaluation-intent modifier detected."
  },
  {
    intent: "segmented",
    pattern: /for (?:startups|small business|enterprises|agencies|ecommerce|teams|freelancers|developers|designers|nonprofits|education|healthcare|real estate|saas|b2b|b2c|beginners|remote teams|solopreneurs)/i,
    priority: 80,
    confidence: 0.82,
    reason: "Audience-segment modifier detected."
  },
  {
    intent: "commercial",
    pattern: /\b(?:best|top\s+\d+|top)\b/i,
    priority: 85,
    confidence: 0.83,
    reason: "Listicle/ranking modifier detected; strong commercial intent."
  },
  {
    intent: "informational",
    pattern: /what is|how to|guide|checklist|template|tutorial|examples|definition|overview|explained|101|introduction|FAQ|learn/i,
    priority: 70,
    confidence: 0.75,
    reason: "Top-of-funnel informational modifier detected."
  },
  {
    intent: "informational",
    pattern: /\breview(?:s|ed)?\b|\brating\b|\bopinion\b/i,
    priority: 72,
    confidence: 0.72,
    reason: "Review/opinion modifier detected; informational with commercial lean."
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
import { mkdir, readFile as readFile2, writeFile } from "fs/promises";
import path2 from "path";

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

const siteUrl = __SITE_URL__;
const jsonLd = __ENTITY_SCHEMA_JSONLD__;
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{entity.title}</title>
    <meta name="description" content={entity.description} />
    <link rel="canonical" href={\`\${siteUrl}/\${entity.slug}\`} />
    <!-- Open Graph -->
    <meta property="og:title" content={entity.title} />
    <meta property="og:description" content={entity.description} />
    <meta property="og:url" content={\`\${siteUrl}/\${entity.slug}\`} />
    <meta property="og:type" content="website" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={entity.title} />
    <meta name="twitter:description" content={entity.description} />
    <!-- JSON-LD Schema -->
    <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
  </head>
  <body>
    <main>
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
__ENTITY_YMYL_DISCLAIMER__
__ENTITY_SECTIONS__
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

const siteUrl = __SITE_URL__;

const jsonLd = __ENTITY_SCHEMA_JSONLD__;

export const metadata: Metadata = {
  title: entity.title,
  description: entity.description,
  alternates: {
    canonical: siteUrl + "/" + entity.slug,
  },
  openGraph: {
    title: entity.title,
    description: entity.description,
    url: siteUrl + "/" + entity.slug,
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
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-950">{entity.title}</h1>
        <p className="max-w-3xl text-base leading-7 text-neutral-700">{entity.description}</p>
      </header>

__ENTITY_YMYL_DISCLAIMER__
      <section className="mt-10">
        <article className="space-y-8">
__ENTITY_SECTIONS__
        </article>
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

const siteUrl = __SITE_URL__;
const jsonLd = __ENTITY_SCHEMA_JSONLD__;

definePageMeta({
  layout: "default",
});

useHead({
  title: entity.title,
  meta: [
    { name: "description", content: entity.description },
    { property: "og:title", content: entity.title },
    { property: "og:description", content: entity.description },
    { property: "og:url", content: siteUrl + "/" + entity.slug },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: entity.title },
    { name: "twitter:description", content: entity.description },
  ],
  link: [{ rel: "canonical", href: siteUrl + "/" + entity.slug }],
  script: [{ type: "application/ld+json", innerHTML: JSON.stringify(jsonLd) }],
});
</script>

<template>
  <main>
    <h1>{{ entity.title }}</h1>
    <p>{{ entity.description }}</p>
__ENTITY_YMYL_DISCLAIMER__
__ENTITY_SECTIONS__
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

const siteUrl = __SITE_URL__;
const jsonLd = __ENTITY_SCHEMA_JSONLD__;

export const meta: MetaFunction = () => {
  return [
    { title: entity.title },
    { name: "description", content: entity.description },
    { tagName: "link", rel: "canonical", href: siteUrl + "/" + entity.slug },
    { property: "og:title", content: entity.title },
    { property: "og:description", content: entity.description },
    { property: "og:url", content: siteUrl + "/" + entity.slug },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: entity.title },
    { name: "twitter:description", content: entity.description },
  ];
};

export default function SophonPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
__ENTITY_YMYL_DISCLAIMER__
__ENTITY_SECTIONS__
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
    siteUrl: string;
    jsonLd: Record<string, unknown>;
  };
</script>

<svelte:head>
  <title>{data.entity.title}</title>
  <meta name="description" content={data.entity.description} />
  <link rel="canonical" href={\`\${data.siteUrl}/\${data.entity.slug}\`} />
  <!-- Open Graph -->
  <meta property="og:title" content={data.entity.title} />
  <meta property="og:description" content={data.entity.description} />
  <meta property="og:url" content={\`\${data.siteUrl}/\${data.entity.slug}\`} />
  <meta property="og:type" content="website" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={data.entity.title} />
  <meta name="twitter:description" content={data.entity.description} />
  <!-- JSON-LD Schema -->
  {@html \`<script type="application/ld+json">\${JSON.stringify(data.jsonLd)}</script>\`}
</svelte:head>

<main>
  <h1>{data.entity.title}</h1>
  <p>{data.entity.description}</p>

__ENTITY_YMYL_DISCLAIMER__
__ENTITY_SECTIONS__
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
var DEFAULT_SITE_URL = "https://example.com";
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
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var YMYL_DISCLAIMER_TEXT = "This content is for informational purposes only and does not constitute professional advice. Consult a qualified professional before making any decisions based on this information.";
function renderYmylDisclaimer(framework, entity) {
  if (!isYmylEntity(entity)) return "";
  const indentMap = {
    nextjs: 6,
    sveltekit: 0,
    remix: 6,
    astro: 6,
    nuxt: 4
  };
  const indent = indentMap[framework];
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);
  const useTailwind = framework === "nextjs";
  if (useTailwind) {
    return [
      `${pad}<aside role="note" aria-label="Disclaimer" className="rounded-xl border border-amber-300 bg-amber-50 p-4">`,
      `${inner}<p className="text-sm text-amber-900">`,
      `${inner}  <strong>Disclaimer:</strong> ${YMYL_DISCLAIMER_TEXT}`,
      `${inner}</p>`,
      `${pad}</aside>`
    ].join("\n");
  }
  return [
    `${pad}<aside role="note" aria-label="Disclaimer">`,
    `${inner}<p>`,
    `${inner}  <strong>Disclaimer:</strong> ${YMYL_DISCLAIMER_TEXT}`,
    `${inner}</p>`,
    `${pad}</aside>`
  ].join("\n");
}
async function loadEnrichedContent(slug, enrichDir) {
  const dir = enrichDir ?? path2.join("data", "enriched");
  try {
    const raw = await readFile2(path2.join(dir, slug, "content.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function renderEnrichedContent(framework, content) {
  const useTailwind = framework === "nextjs";
  const indentMap = {
    nextjs: { indent: 10, gap: "\n\n" },
    sveltekit: { indent: 2, gap: "\n\n" },
    remix: { indent: 6, gap: "\n" },
    astro: { indent: 6, gap: "\n" },
    nuxt: { indent: 4, gap: "\n" }
  };
  const { indent, gap } = indentMap[framework];
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);
  const parts = [];
  if (content.intro) {
    parts.push(
      useTailwind ? `${pad}<section className="space-y-3">
${inner}<p className="text-base leading-7 text-neutral-700">${escapeHtml(content.intro)}</p>
${pad}</section>` : `${pad}<section>
${inner}<p>${escapeHtml(content.intro)}</p>
${pad}</section>`
    );
  }
  for (const section of content.sections) {
    parts.push(
      useTailwind ? `${pad}<section className="space-y-3 rounded-3xl bg-amber-50 p-6">
${inner}<h2 className="text-xl font-medium text-neutral-950">${escapeHtml(section.heading)}</h2>
${inner}<p className="text-neutral-700">${escapeHtml(section.body)}</p>
${pad}</section>` : `${pad}<section>
${inner}<h2>${escapeHtml(section.heading)}</h2>
${inner}<p>${escapeHtml(section.body)}</p>
${pad}</section>`
    );
  }
  if (content.faqs && content.faqs.length > 0) {
    const faqItems = content.faqs.map(
      (faq) => useTailwind ? `${inner}  <dt className="font-medium text-neutral-950">${escapeHtml(faq.question)}</dt>
${inner}  <dd className="text-neutral-700">${escapeHtml(faq.answer)}</dd>` : `${inner}  <dt>${escapeHtml(faq.question)}</dt>
${inner}  <dd>${escapeHtml(faq.answer)}</dd>`
    ).join("\n");
    parts.push(
      useTailwind ? `${pad}<section className="space-y-3">
${inner}<h2 className="text-xl font-medium text-neutral-950">Frequently Asked Questions</h2>
${inner}<dl className="space-y-4">
${faqItems}
${inner}</dl>
${pad}</section>` : `${pad}<section>
${inner}<h2>Frequently Asked Questions</h2>
${inner}<dl>
${faqItems}
${inner}</dl>
${pad}</section>`
    );
  }
  return parts.join(gap);
}
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
      return path2.join("src", "pages");
    case "nuxt":
      return "pages";
    case "sveltekit":
      return path2.join("src", "routes");
    case "remix":
      return path2.join("app", "routes");
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
function buildHydrationMap(entity, siteUrl, enriched) {
  const resolvedSiteUrl = (siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, "");
  const title = enriched?.seo?.title ?? entity.metadata.title ?? entity.name;
  const description = enriched?.seo?.metaDescription ?? entity.metadata.description ?? `Explore ${entity.name}.`;
  const schemaJsonLd = {
    "@context": "https://schema.org",
    "@type": enriched?.schema?.type ?? "WebPage",
    name: title,
    description,
    url: `${resolvedSiteUrl}/${entity.slug}`
  };
  return {
    "__ENTITY_NAME__": safeJsonStringify(entity.name),
    "__ENTITY_SLUG__": safeJsonStringify(entity.slug),
    "__ENTITY_TITLE__": safeJsonStringify(title),
    "__ENTITY_DESCRIPTION__": safeJsonStringify(description),
    "__ENTITY_TAGS__": safeJsonStringify(entity.metadata.tags ?? []),
    "__ENTITY_ATTRIBUTES__": safeJsonStringify(entity.metadata.attributes ?? {}),
    "__SITE_URL__": safeJsonStringify(resolvedSiteUrl),
    "__ENTITY_SCHEMA_JSONLD__": JSON.stringify(schemaJsonLd, null, 2)
  };
}
function hydrateTemplate(template, entity, framework, siteUrl, enriched) {
  const intent = classifyIntent(entity.name).intent;
  let sectionsHtml;
  if (enriched?.content) {
    sectionsHtml = renderEnrichedContent(framework, enriched.content);
  } else {
    sectionsHtml = renderSections(framework, getSections(intent));
  }
  const replacements = {
    ...buildHydrationMap(entity, siteUrl, enriched),
    "__ENTITY_SECTIONS__": sectionsHtml,
    "__ENTITY_YMYL_DISCLAIMER__": renderYmylDisclaimer(framework, entity)
  };
  return template.replace(/__(?:ENTITY|SITE)_[A-Z_]+__/g, (match) => {
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
      return path2.join(outputRoot, slug, "page.tsx");
    case "astro":
      return path2.join(outputRoot, `${slug}.astro`);
    case "nuxt":
      return path2.join(outputRoot, `${slug}.vue`);
    case "sveltekit":
      return path2.join(outputRoot, slug, "+page.svelte");
    case "remix":
      return path2.join(outputRoot, `${slug}.tsx`);
  }
}
function buildAdditionalFiles(framework, outputRoot, entity, siteUrl, enriched) {
  if (framework !== "sveltekit") {
    return [];
  }
  return [
    {
      filePath: path2.join(outputRoot, entity.slug, "+page.ts"),
      content: hydrateTemplate(buildSvelteKitPageModule(), entity, framework, siteUrl, enriched)
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
      const existing = await readFile2(filePath, "utf8");
      if (!isManagedBySophon(existing)) {
        console.warn(
          `Skipping existing file already in place: ${filePath} (use --force to overwrite).`
        );
        return false;
      }
    } catch {
    }
  }
  await mkdir(path2.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  console.log(`Generated file -> ${filePath}`);
  return true;
}
async function generate(options) {
  const outputRoot = options.output ?? defaultOutputRoot(options.framework);
  const customTemplate = options.template ? await readFile2(options.template, "utf8") : void 0;
  const seenSlugs = /* @__PURE__ */ new Set();
  const warnings = [];
  let generated = 0;
  let todosRemaining = 0;
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
    const enriched = await loadEnrichedContent(entity.slug);
    const template = customTemplate ?? buildFrameworkTemplate(options, entity);
    const pageContent = customTemplate ? prependCommentBlock(options.framework, hydrateTemplate(template, entity, options.framework, options.site, enriched)) : hydrateTemplate(template, entity, options.framework, options.site, enriched);
    const pagePath = buildMainPagePath(options.framework, outputRoot, entity.slug);
    const pageWritten = await writeGeneratedFile(pagePath, pageContent, {
      force: options.force
    });
    if (!pageWritten) {
      warnings.push(`Page skipped because existing implementation was detected: ${pagePath}`);
      continue;
    }
    for (const file of buildAdditionalFiles(options.framework, outputRoot, entity, options.site, enriched)) {
      await writeGeneratedFile(file.filePath, prependCommentBlock(options.framework, file.content), {
        force: options.force
      });
    }
    if (!enriched) {
      todosRemaining += TODO_SECTIONS_PER_PAGE;
    }
    generated += 1;
  }
  const summary = {
    total: options.entities.length,
    generated,
    warnings,
    todos: todosRemaining
  };
  console.log(`Total entities processed: ${summary.total}`);
  console.log(`Pages generated: ${summary.generated}`);
  console.log(`Warnings: ${summary.warnings.length}`);
  console.log(`TODOs remaining: ${summary.todos}`);
  return summary;
}

// src/core/technical.ts
import path3 from "path";
function todayDate() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function sitemapPriority(entity) {
  const { intent, confidence } = classifyIntent(entity.name);
  switch (intent) {
    case "commercial":
      return confidence >= 0.85 ? "0.9" : "0.8";
    case "comparison":
      return "0.8";
    case "segmented":
      return "0.7";
    case "informational":
      return "0.5";
    default:
      return "0.6";
  }
}
function sitemapChangefreq(entity) {
  const { intent } = classifyIntent(entity.name);
  return intent === "commercial" || intent === "comparison" ? "weekly" : "monthly";
}
function buildSitemap(siteUrl, entities) {
  const lastmod = todayDate();
  const urls = entities.map(
    (entity) => `  <url>
    <loc>${siteUrl}/${entity.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${sitemapChangefreq(entity)}</changefreq>
    <priority>${sitemapPriority(entity)}</priority>
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
var INTENT_AFFINITY = {
  commercial: ["comparison", "segmented"],
  comparison: ["commercial", "comparison"],
  segmented: ["commercial", "informational"],
  informational: ["segmented", "commercial"]
};
function relatedScore(entity, candidate) {
  let score = 0;
  const reasons = [];
  if (entity.seedKeyword && candidate.seedKeyword && entity.seedKeyword === candidate.seedKeyword) {
    score += 3;
    reasons.push("same seed");
  }
  const tagCount = countSharedTags(entity, candidate);
  if (tagCount > 0) {
    score += tagCount * 2;
    reasons.push(`${tagCount} shared tags`);
  }
  const entityIntent = classifyIntent(entity.name).intent;
  const candidateIntent = classifyIntent(candidate.name).intent;
  const preferredIntents = INTENT_AFFINITY[entityIntent] ?? [];
  if (preferredIntents.includes(candidateIntent)) {
    score += 4;
    reasons.push(`${entityIntent}\u2192${candidateIntent} affinity`);
  }
  const entityWords = new Set(entity.name.toLowerCase().split(/\s+/));
  const candidateWords = candidate.name.toLowerCase().split(/\s+/);
  const overlap = candidateWords.filter((w) => entityWords.has(w) && w.length > 3).length;
  if (overlap > 0) {
    score += overlap;
    reasons.push(`${overlap} word overlap`);
  }
  return { score, reason: reasons.join(", ") || "none" };
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
    relatedEntities: entities.filter((candidate) => candidate.slug !== entity.slug).map((candidate) => {
      const { score, reason } = relatedScore(entity, candidate);
      return { slug: candidate.slug, score, reason };
    }).filter((candidate) => candidate.score > 0).sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug)).slice(0, 5).map((candidate) => ({ slug: candidate.slug, reason: candidate.reason }))
  }));
}
function buildFaqSchema(entity, enrichedFaqs) {
  if (enrichedFaqs && enrichedFaqs.length > 0) {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: enrichedFaqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer
        }
      }))
    };
  }
  return null;
}
async function technical(options) {
  const outputRoot = options.output ?? "public";
  const siteUrl = options.site.replace(/\/$/, "");
  const technicalRoot = path3.join(outputRoot, "sophon");
  const sitemap = buildSitemap(siteUrl, options.entities);
  const robots = buildRobots(siteUrl);
  const schema = buildSchema(siteUrl, options.entities);
  const internalLinks = buildInternalLinks(options.entities);
  const hreflang = buildHreflang(siteUrl, options.entities);
  const faqSchemas = [];
  for (const entity of options.entities) {
    const enriched = await loadEnrichedContent(entity.slug);
    const faq = buildFaqSchema(entity, enriched?.content?.faqs);
    if (faq) {
      faqSchemas.push({ slug: entity.slug, faq });
    }
  }
  await Promise.all([
    writeGeneratedFile(path3.join(outputRoot, "sitemap.xml"), sitemap, {
      force: options.force
    }),
    writeGeneratedFile(path3.join(outputRoot, "robots.txt"), robots, {
      force: options.force
    }),
    writeGeneratedFile(path3.join(technicalRoot, "schema.json"), `${JSON.stringify(schema, null, 2)}
`, {
      force: options.force
    }),
    writeGeneratedFile(
      path3.join(technicalRoot, "internal-links.json"),
      `${JSON.stringify(internalLinks, null, 2)}
`,
      {
        force: options.force
      }
    ),
    writeGeneratedFile(path3.join(technicalRoot, "hreflang.txt"), hreflang, {
      force: options.force
    }),
    faqSchemas.length > 0 ? writeGeneratedFile(
      path3.join(technicalRoot, "faq-schema.json"),
      `${JSON.stringify(faqSchemas, null, 2)}
`,
      { force: options.force }
    ) : Promise.resolve()
  ]);
  console.log(`sitemap.xml -> ${options.entities.length} URLs`);
  console.log(`schema.json -> ${schema.length} records`);
  console.log(`faq-schema.json -> ${faqSchemas.length} FAQ pages`);
  console.log(`internal-links.json -> ${internalLinks.length} nodes`);
  console.log(`hreflang.txt -> ${options.entities.length} entity scaffolds`);
}

// src/core/enrich.ts
import { readFile as readFile3 } from "fs/promises";
import path4 from "path";
import Anthropic from "@anthropic-ai/sdk";

// src/core/humanize.ts
var EM_DASH_RE = /\s*[—–]\s*/g;
var DOUBLE_HYPHEN_RE = /\s*--\s*/g;
var ELLIPSIS_RE = /\.{3,}/g;
var SMART_QUOTES_RE = /[\u201C\u201D]/g;
var SMART_SINGLE_RE = /[\u2018\u2019]/g;
var AI_PHRASES = [
  // Filler openers
  { pattern: /\bIn today'?s (?:fast-paced|digital|modern|ever-changing|rapidly evolving) (?:world|landscape|era|environment)\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bIt'?s worth noting that\s*/gi, replacement: "" },
  { pattern: /\bIt is worth noting that\s*/gi, replacement: "" },
  { pattern: /\bIt'?s important to (?:note|understand|remember|recognize) that\s*/gi, replacement: "" },
  { pattern: /\bIt is important to (?:note|understand|remember|recognize) that\s*/gi, replacement: "" },
  { pattern: /\bLet'?s dive (?:in|into|deeper)\b[.!]?\s*/gi, replacement: "" },
  { pattern: /\bLet us dive (?:in|into|deeper)\b[.!]?\s*/gi, replacement: "" },
  { pattern: /\bWithout further ado\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bIn this (?:article|guide|post|section),? we (?:will|'ll) (?:explore|discuss|cover|look at|examine|delve into)\b[.]?\s*/gi, replacement: "" },
  // Hedge phrases
  { pattern: /\bAt the end of the day\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bWhen all is said and done\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bAll things considered\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bIn the grand scheme of things\b[,.]?\s*/gi, replacement: "" },
  // Transition bloat
  { pattern: /\bThat being said\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bHaving said that\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bWith that in mind\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bOn the other hand\b[,.]?\s*/gi, replacement: "However, " },
  { pattern: /\bMoreover\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bFurthermore\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bAdditionally\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bNevertheless\b[,.]?\s*/gi, replacement: "Still, " },
  { pattern: /\bNonetheless\b[,.]?\s*/gi, replacement: "Still, " },
  // AI-typical superlatives and hedges
  { pattern: /\bdelve(?:s|d)? (?:into|deeper)\b/gi, replacement: "covers" },
  { pattern: /\bdelve\b/gi, replacement: "explore" },
  { pattern: /\btap(?:s|ped)? into (?:the power|the potential)\b/gi, replacement: "uses" },
  { pattern: /\bleverage(?:s|d)?\b/gi, replacement: "use" },
  { pattern: /\butilize(?:s|d)?\b/gi, replacement: "use" },
  { pattern: /\bfacilitate(?:s|d)?\b/gi, replacement: "help" },
  { pattern: /\bseamless(?:ly)?\b/gi, replacement: "smooth" },
  { pattern: /\brobust\b/gi, replacement: "solid" },
  { pattern: /\bcutting-edge\b/gi, replacement: "modern" },
  { pattern: /\bgame-?changer\b/gi, replacement: "major improvement" },
  { pattern: /\bparadigm shift\b/gi, replacement: "significant change" },
  { pattern: /\bsynerg(?:y|ies|ize)\b/gi, replacement: "combination" },
  { pattern: /\bholistic(?:ally)?\b/gi, replacement: "complete" },
  { pattern: /\bIn conclusion\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bTo summarize\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bTo sum up\b[,.]?\s*/gi, replacement: "" },
  // Exclamation mark overuse (replace ! with . in most contexts)
  { pattern: /([a-z])!\s/g, replacement: "$1. " }
];
var LEADING_SPACE_RE = /^\s+/;
var MULTI_SPACE_RE = / {2,}/g;
var SENTENCE_START_RE = /(?:^|[.!?]\s+)([a-z])/g;
function fixSentenceCase(text) {
  return text.replace(SENTENCE_START_RE, (match) => match.toUpperCase());
}
function fixOrphanedPunctuation(text) {
  return text.replace(/\s+([,.])/g, "$1").replace(/,\s*,/g, ",").replace(/\.\s*\./g, ".").replace(/\s*\.\s*$/gm, ".");
}
function humanize(text) {
  let result = text;
  result = result.replace(EM_DASH_RE, " - ");
  result = result.replace(DOUBLE_HYPHEN_RE, " - ");
  result = result.replace(ELLIPSIS_RE, "...");
  result = result.replace(SMART_QUOTES_RE, '"');
  result = result.replace(SMART_SINGLE_RE, "'");
  for (const { pattern, replacement } of AI_PHRASES) {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(MULTI_SPACE_RE, " ");
  result = fixOrphanedPunctuation(result);
  result = result.replace(LEADING_SPACE_RE, "");
  result = fixSentenceCase(result);
  result = result.split("\n").map((line) => line.trimEnd()).join("\n");
  return result.trim();
}
function humanizeContent(obj) {
  if (typeof obj === "string") {
    return humanize(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(humanizeContent);
  }
  if (obj !== null && typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = humanizeContent(value);
    }
    return result;
  }
  return obj;
}
function countAiPatterns(text) {
  let count = 0;
  count += (text.match(EM_DASH_RE) ?? []).length;
  for (const { pattern } of AI_PHRASES) {
    const globalPattern = new RegExp(pattern.source, "gi");
    count += (text.match(globalPattern) ?? []).length;
  }
  return count;
}

// src/core/enrich.ts
var MODEL = "claude-sonnet-4-20250514";
var DEFAULT_CONCURRENCY = 3;
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
  const outputRoot = options.output ?? path4.join("data", "enriched");
  const client = new Anthropic({ apiKey });
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const toEnrich = [];
  for (const entity of options.entities) {
    const outputPath = path4.join(outputRoot, entity.slug, "content.json");
    if (!options.force) {
      try {
        await readFile3(outputPath, "utf8");
        console.log(`Cached: ${entity.slug} (use --force to re-enrich)`);
        continue;
      } catch {
      }
    }
    toEnrich.push(entity);
  }
  if (toEnrich.length === 0) {
    console.log("All entities already enriched. Use --force to re-enrich.");
    return;
  }
  console.log(`Enriching ${toEnrich.length} entities (${options.entities.length - toEnrich.length} cached, concurrency: ${concurrency})...`);
  let completed = 0;
  let failed = 0;
  async function enrichOne(entity) {
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
      const raw = JSON.parse(messageText(response));
      const humanized = humanizeContent(raw);
      await writeGeneratedFile(
        path4.join(outputRoot, entity.slug, "content.json"),
        `${JSON.stringify(humanized, null, 2)}
`,
        { force: options.force }
      );
      completed++;
      console.log(`  \u2713 ${entity.slug} (${completed}/${toEnrich.length})`);
    } catch (error) {
      failed++;
      console.error(`  \u2717 ${entity.slug}:`, error instanceof Error ? error.message : error);
    }
  }
  const pool = [];
  for (const entity of toEnrich) {
    const promise = enrichOne(entity);
    pool.push(promise);
    if (pool.length >= concurrency) {
      await Promise.race(pool);
      for (let i = pool.length - 1; i >= 0; i--) {
        const settled = await Promise.race([pool[i].then(() => true), Promise.resolve(false)]);
        if (settled) pool.splice(i, 1);
      }
    }
  }
  await Promise.all(pool);
  console.log(`Enrichment complete: ${completed} succeeded, ${failed} failed`);
}

// src/core/teach.ts
import { writeFile as writeFile2 } from "fs/promises";
import path5 from "path";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
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
  const rl = createInterface({ input, output });
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
    const outputPath = path5.join(process.cwd(), ".sophon.md");
    await writeFile2(outputPath, formatContext(answers), "utf8");
    console.log(`
Context saved to ${outputPath}`);
    console.log("Next step: use `sophon discover` to find entities, or `sophon run` to execute the full pipeline.");
  } finally {
    rl.close();
  }
}

// src/core/audit.ts
import { access, readdir, readFile as readFile4 } from "fs/promises";
import path6 from "path";
var IGNORED_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", ".next", ".svelte-kit", ".nuxt"]);
async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
async function walkFiles(root) {
  const files = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const fullPath = path6.join(current, entry.name);
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
      const content = await readFile4(file, "utf8");
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
      implemented: await exists(path6.join(root, "public", "sitemap.xml")) || await exists(path6.join(root, "static", "sitemap.xml")) || await exists(path6.join(root, "sitemap.xml")),
      weight: 15,
      details: "Expected one of: public/sitemap.xml, static/sitemap.xml, sitemap.xml"
    },
    {
      label: "Robots",
      implemented: await exists(path6.join(root, "public", "robots.txt")) || await exists(path6.join(root, "static", "robots.txt")) || await exists(path6.join(root, "robots.txt")),
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
      implemented: await exists(path6.join(root, "app", "not-found.tsx")) || await exists(path6.join(root, "pages", "404.tsx")) || await exists(path6.join(root, "src", "routes", "+error.svelte")),
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
  const wordCount2 = entity.name.split(/\s+/).length;
  const specific = wordCount2 >= 3;
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

// src/core/optimize/index.ts
import path8 from "path";

// src/core/optimize/gscClient.ts
var GSC_API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";
function defaultDateRange() {
  const end = /* @__PURE__ */ new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0]
  };
}
async function fetchGSCData(options) {
  const accessToken = options.accessToken ?? process.env.GSC_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "GSC access token is required. Set GSC_ACCESS_TOKEN or pass --access-token."
    );
  }
  const { startDate, endDate } = options.startDate && options.endDate ? { startDate: options.startDate, endDate: options.endDate } : defaultDateRange();
  const siteUrl = encodeURIComponent(options.site);
  const limit = options.limit ?? 500;
  const pageRows = await queryGSC(siteUrl, accessToken, {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: limit
  });
  const pages = [];
  for (const row of pageRows) {
    const pageUrl = row.keys[0];
    const queryRows = await queryGSC(siteUrl, accessToken, {
      startDate,
      endDate,
      dimensions: ["page", "query"],
      dimensionFilterGroups: [
        {
          filters: [
            { dimension: "page", operator: "equals", expression: pageUrl }
          ]
        }
      ],
      rowLimit: 20
    });
    pages.push({
      page: pageUrl,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      topQueries: queryRows.map((qr) => ({
        keys: [qr.keys[1]],
        clicks: qr.clicks,
        impressions: qr.impressions,
        ctr: qr.ctr,
        position: qr.position
      }))
    });
  }
  return pages;
}
async function queryGSC(siteUrl, accessToken, body) {
  const url = `${GSC_API_BASE}/sites/${siteUrl}/searchAnalytics/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GSC API error (${response.status}): ${text}`);
  }
  const data = await response.json();
  return (data.rows ?? []).map((row) => ({
    keys: row.keys,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: Math.round(row.position * 10) / 10
  }));
}
function buildMetricsFromRows(rows) {
  const pageMap = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const page = row.keys[0];
    const existing = pageMap.get(page);
    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.topQueries.push(row);
    } else {
      pageMap.set(page, {
        page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        topQueries: [row]
      });
    }
  }
  for (const metrics of pageMap.values()) {
    metrics.ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
  }
  return Array.from(pageMap.values());
}

// src/core/optimize/entityMapper.ts
function mapEntitiesToGSC(entities, gscPages, siteUrl) {
  const normalizedSite = siteUrl.replace(/\/+$/, "");
  return entities.map((entity) => {
    const metrics = findMatchingPage(entity, gscPages, normalizedSite);
    return { entity, metrics };
  });
}
function findMatchingPage(entity, gscPages, siteUrl) {
  const slug = entity.slug;
  const expectedUrl = `${siteUrl}/${slug}`;
  const exact = gscPages.find(
    (p) => normalizeUrl(p.page) === normalizeUrl(expectedUrl)
  );
  if (exact) return exact;
  const endsWith = gscPages.find((p) => {
    const path10 = urlPath(p.page);
    return path10 === `/${slug}` || path10 === `/${slug}/`;
  });
  if (endsWith) return endsWith;
  const contains = gscPages.find((p) => {
    const path10 = urlPath(p.page);
    return path10.includes(`/${slug}`);
  });
  if (contains) return contains;
  const entitySlug = slugify(entity.name);
  const fuzzy = gscPages.find((p) => {
    const segments = urlPath(p.page).split("/").filter(Boolean);
    return segments.some((seg) => slugify(seg) === entitySlug);
  });
  return fuzzy;
}
function normalizeUrl(url) {
  return url.replace(/\/+$/, "").toLowerCase();
}
function urlPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
function filterMappedEntities(mapped) {
  return mapped.filter((m) => m.metrics !== void 0);
}
function filterUnmappedEntities(mapped) {
  return mapped.filter((m) => m.metrics === void 0);
}

// src/core/optimize/recommender.ts
var RULES = [
  {
    issueTypes: ["low_ctr", "high_impressions_low_clicks"],
    generate: (_metrics, entity) => [
      {
        type: "meta",
        action: `Rewrite title tag for "${entity.name}" \u2014 use power words, numbers, or brackets`,
        reasoning: "Low CTR relative to position indicates the title/meta description is not compelling enough in search results."
      },
      {
        type: "meta",
        action: "Improve meta description with a clear CTA and value proposition",
        reasoning: "A stronger meta description can significantly improve CTR without changing position."
      }
    ]
  },
  {
    issueTypes: ["striking_distance"],
    generate: (_metrics, entity) => [
      {
        type: "content",
        action: `Add 2-3 new sections to increase content depth for "${entity.name}"`,
        reasoning: "Pages in positions 8-20 are in striking distance of page 1. Additional content depth can push rankings higher."
      },
      {
        type: "structure",
        action: "Add FAQ section with schema markup",
        reasoning: "FAQ schema can earn rich results and increase SERP visibility, boosting CTR."
      },
      {
        type: "linking",
        action: "Add internal links from high-authority pages to this entity",
        reasoning: "Internal links pass authority. Linking from strong pages can improve ranking for striking-distance pages."
      }
    ]
  },
  {
    issueTypes: ["poor_position"],
    generate: (_metrics, entity) => [
      {
        type: "content",
        action: `Significantly expand content for "${entity.name}" \u2014 aim for comprehensive coverage`,
        reasoning: "Poor position (>20) indicates the page needs substantial content improvement to compete."
      },
      {
        type: "structure",
        action: "Review and align page structure with top-ranking competitors",
        reasoning: "Pages ranked poorly often lack the content structure that Google favors for this query type."
      },
      {
        type: "meta",
        action: "Review target keyword alignment \u2014 ensure title and H1 match search intent",
        reasoning: "Keyword mismatch between page content and user search intent can cause poor rankings."
      }
    ]
  },
  {
    issueTypes: ["low_impressions"],
    generate: (_metrics, entity) => [
      {
        type: "structure",
        action: "Verify page is indexed \u2014 check Google Search Console coverage report",
        reasoning: "Low impressions may indicate the page is not indexed or has crawl issues."
      },
      {
        type: "content",
        action: `Review target keyword for "${entity.name}" \u2014 may need keyword pivot`,
        reasoning: "If the page gets few impressions, the target keyword may have minimal search volume or the page may not be relevant enough."
      }
    ]
  },
  {
    issueTypes: ["intent_mismatch"],
    generate: (_metrics, entity) => [
      {
        type: "structure",
        action: `Restructure page for "${entity.name}" to match dominant search intent`,
        reasoning: "Pages that don't match search intent (informational vs commercial) underperform in rankings."
      },
      {
        type: "content",
        action: "Add comparison table or product breakdown if intent is commercial",
        reasoning: "Commercial intent queries expect comparison content rather than informational articles."
      }
    ]
  },
  {
    issueTypes: ["weak_linking"],
    generate: () => [
      {
        type: "linking",
        action: "Build internal link cluster \u2014 link 3-5 related entity pages bidirectionally",
        reasoning: "Weak internal linking reduces topical authority signals. Cross-linking related entities improves crawlability and ranking."
      }
    ]
  }
];
function generateRecommendations(issueTypes, metrics, entity) {
  const recommendations = [];
  const seen = /* @__PURE__ */ new Set();
  for (const rule of RULES) {
    const matches = rule.issueTypes.some((t) => issueTypes.includes(t));
    if (!matches) continue;
    for (const rec of rule.generate(metrics, entity)) {
      if (!seen.has(rec.action)) {
        seen.add(rec.action);
        recommendations.push(rec);
      }
    }
  }
  return recommendations;
}

// src/core/optimize/analyzer.ts
var CTR_THRESHOLDS = {
  "1-3": 0.05,
  // positions 1-3: expect >5% CTR
  "4-7": 0.03,
  // positions 4-7: expect >3% CTR
  "8-10": 0.02,
  // positions 8-10: expect >2% CTR
  "11-20": 0.01
  // positions 11-20: expect >1% CTR
};
var LOW_IMPRESSIONS_THRESHOLD = 50;
var HIGH_IMPRESSIONS_THRESHOLD = 500;
var STRIKING_DISTANCE_RANGE = [8, 20];
function analyzeEntity(mapped) {
  const { entity, metrics } = mapped;
  if (!metrics) {
    return {
      entity: entity.name,
      slug: entity.slug,
      metrics: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      optimizationScore: 0,
      issues: ["No GSC data found \u2014 page may not be indexed"],
      issueTypes: ["low_impressions"],
      recommendations: [
        {
          type: "structure",
          action: "Verify page is indexed and submit to Google Search Console",
          reasoning: "No performance data found for this entity's URL."
        }
      ],
      priority: "high"
    };
  }
  const issues = [];
  const issueTypes = [];
  const ctrIssue = checkCTR(metrics);
  if (ctrIssue) {
    issues.push(ctrIssue.message);
    issueTypes.push("low_ctr");
  }
  if (metrics.impressions >= HIGH_IMPRESSIONS_THRESHOLD && metrics.ctr < 0.02) {
    issues.push(
      `High impressions (${metrics.impressions}) but low CTR (${(metrics.ctr * 100).toFixed(1)}%) \u2014 title/meta likely underperforming`
    );
    issueTypes.push("high_impressions_low_clicks");
  }
  if (metrics.position >= STRIKING_DISTANCE_RANGE[0] && metrics.position <= STRIKING_DISTANCE_RANGE[1]) {
    issues.push(
      `Position ${metrics.position} \u2014 in striking distance, needs content depth improvement`
    );
    issueTypes.push("striking_distance");
  }
  if (metrics.position > 20) {
    issues.push(
      `Position ${metrics.position} \u2014 poor ranking, may need significant content overhaul`
    );
    issueTypes.push("poor_position");
  }
  if (metrics.impressions < LOW_IMPRESSIONS_THRESHOLD) {
    issues.push(
      `Low impressions (${metrics.impressions}) \u2014 possible keyword mismatch or poor indexing`
    );
    issueTypes.push("low_impressions");
  }
  const optimizationScore = calculateScore(metrics, issueTypes);
  const recommendations = generateRecommendations(issueTypes, metrics, entity);
  const priority = scoreToPriority(optimizationScore);
  return {
    entity: entity.name,
    slug: entity.slug,
    metrics: {
      clicks: metrics.clicks,
      impressions: metrics.impressions,
      ctr: Math.round(metrics.ctr * 1e4) / 1e4,
      position: Math.round(metrics.position * 10) / 10
    },
    optimizationScore,
    issues,
    issueTypes,
    recommendations,
    priority
  };
}
function analyzeAll(mappedEntities) {
  return mappedEntities.map(analyzeEntity).filter((r) => r !== void 0).sort((a, b) => a.optimizationScore - b.optimizationScore);
}
function checkCTR(metrics) {
  const pos = metrics.position;
  let expectedCtr;
  if (pos <= 3) {
    expectedCtr = CTR_THRESHOLDS["1-3"];
  } else if (pos <= 7) {
    expectedCtr = CTR_THRESHOLDS["4-7"];
  } else if (pos <= 10) {
    expectedCtr = CTR_THRESHOLDS["8-10"];
  } else if (pos <= 20) {
    expectedCtr = CTR_THRESHOLDS["11-20"];
  } else {
    return void 0;
  }
  if (metrics.ctr < expectedCtr) {
    return {
      message: `Low CTR (${(metrics.ctr * 100).toFixed(1)}%) for position ${metrics.position} \u2014 expected >${(expectedCtr * 100).toFixed(0)}%`
    };
  }
  return void 0;
}
function calculateScore(metrics, issueTypes) {
  let score = 100;
  if (metrics.position <= 3) {
    score -= 0;
  } else if (metrics.position <= 10) {
    score -= Math.round((metrics.position - 3) * 3);
  } else if (metrics.position <= 20) {
    score -= 21 + Math.round((metrics.position - 10) * 2);
  } else {
    score -= 40;
  }
  if (issueTypes.includes("low_ctr")) score -= 15;
  if (issueTypes.includes("high_impressions_low_clicks")) score -= 10;
  if (metrics.impressions < LOW_IMPRESSIONS_THRESHOLD) score -= 20;
  else if (metrics.impressions < 200) score -= 10;
  score -= Math.min(issueTypes.length * 5, 15);
  return Math.max(0, Math.min(100, score));
}
function scoreToPriority(score) {
  if (score < 30) return "critical";
  if (score < 50) return "high";
  if (score < 70) return "medium";
  return "low";
}

// src/core/optimize/optimizer.ts
import { readFile as readFile5 } from "fs/promises";
import path7 from "path";
var SOPHON_MARKER = "SOPHON GENERATED";
async function applyAutoFixes(results, entities, outputRoot) {
  const fixResults = [];
  for (const result of results) {
    if (result.recommendations.length === 0) continue;
    const entity = entities.find((e) => e.slug === result.slug);
    if (!entity) continue;
    const fixResult = await applyEntityFixes(result, entity, outputRoot);
    if (fixResult.applied.length > 0 || fixResult.skipped.length > 0) {
      fixResults.push(fixResult);
    }
  }
  return fixResults;
}
async function applyEntityFixes(result, entity, outputRoot) {
  const applied = [];
  const skipped = [];
  const metaRecs = result.recommendations.filter((r) => r.type === "meta");
  if (metaRecs.length === 0) {
    return { slug: result.slug, applied, skipped };
  }
  const enrichedPath = path7.join(outputRoot, "data", "enriched", entity.slug, "content.json");
  try {
    assertSafePath(enrichedPath);
    const raw = await readFile5(enrichedPath, "utf8");
    const content = JSON.parse(raw);
    const seo = content.seo ?? {};
    const warnings = content.warnings ?? [];
    for (const rec of metaRecs) {
      warnings.push(`[OPTIMIZE] ${rec.action}`);
      applied.push(`Added optimization TODO: ${rec.action}`);
    }
    content.seo = seo;
    content.warnings = warnings;
    await writeGeneratedFile(
      enrichedPath,
      `${JSON.stringify(content, null, 2)}
`,
      { force: true }
    );
  } catch {
    for (const rec of metaRecs) {
      skipped.push(`Could not auto-fix: ${rec.action} (enriched file not found)`);
    }
  }
  return { slug: result.slug, applied, skipped };
}
async function isSophonFile(filePath) {
  try {
    const content = await readFile5(filePath, "utf8");
    return content.includes(SOPHON_MARKER);
  } catch {
    return false;
  }
}

// src/core/optimize/index.ts
async function optimize(options) {
  const { site, entities, limit, autoFix, output: output2 } = options;
  console.log("Fetching GSC performance data...");
  const gscPages = options.gscData ?? await fetchGSCData({
    site,
    limit,
    accessToken: options.accessToken
  });
  console.log(`Fetched metrics for ${gscPages.length} pages`);
  console.log("Mapping GSC data to entities...");
  const mapped = mapEntitiesToGSC(entities, gscPages, site);
  const withData = filterMappedEntities(mapped);
  console.log(`Mapped ${withData.length}/${entities.length} entities to GSC data`);
  console.log("Analyzing performance...");
  const results = analyzeAll(mapped);
  const report = buildReport(site, entities.length, results);
  const outputPath = output2 ?? path8.join("data", "optimization-report.json");
  await writeGeneratedFile(
    outputPath,
    `${JSON.stringify(report, null, 2)}
`,
    { force: true }
  );
  console.log(`Optimization report written to ${outputPath}`);
  if (autoFix) {
    console.log("Applying auto-fixes...");
    const fixResults = await applyAutoFixes(results, entities, process.cwd());
    const totalApplied = fixResults.reduce((sum, r) => sum + r.applied.length, 0);
    const totalSkipped = fixResults.reduce((sum, r) => sum + r.skipped.length, 0);
    console.log(`Auto-fix: ${totalApplied} applied, ${totalSkipped} skipped`);
  }
  printSummary(report);
  return report;
}
function buildReport(site, totalEntities, results) {
  const summary = {
    critical: results.filter((r) => r.priority === "critical").length,
    high: results.filter((r) => r.priority === "high").length,
    medium: results.filter((r) => r.priority === "medium").length,
    low: results.filter((r) => r.priority === "low").length,
    averageScore: results.length > 0 ? Math.round(
      results.reduce((sum, r) => sum + r.optimizationScore, 0) / results.length
    ) : 0
  };
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    site,
    totalEntities,
    analyzedEntities: results.length,
    summary,
    entities: results
  };
}
function printSummary(report) {
  console.log(`
Optimization Report Summary`);
  console.log(`  Site: ${report.site}`);
  console.log(`  Entities analyzed: ${report.analyzedEntities}/${report.totalEntities}`);
  console.log(`  Average score: ${report.summary.averageScore}/100`);
  console.log(`  Critical: ${report.summary.critical} | High: ${report.summary.high} | Medium: ${report.summary.medium} | Low: ${report.summary.low}`);
  const topIssues = report.entities.filter((e) => e.priority === "critical" || e.priority === "high").slice(0, 5);
  if (topIssues.length > 0) {
    console.log(`
Top priority entities:`);
    for (const entity of topIssues) {
      console.log(`  ${entity.slug}: score ${entity.optimizationScore}/100 (${entity.priority})`);
      for (const issue of entity.issues.slice(0, 2)) {
        console.log(`    - ${issue}`);
      }
    }
  }
}

// src/core/quality.ts
function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}
function syllableCount(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;
  for (const char of w) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  if (w.endsWith("e") && count > 1) count--;
  if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) count++;
  return Math.max(1, count);
}
function sentenceCount(text) {
  return Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
}
function fleschKincaid(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const sentences = sentenceCount(text);
  const syllables = words.reduce((sum, w) => sum + syllableCount(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}
function checkHeadingHierarchy(text) {
  const headings = [...text.matchAll(/^(#{1,6})\s+.+$/gm)].map((m) => m[1].length);
  if (headings.length === 0) {
    return { valid: false, detail: "No headings found" };
  }
  if (headings[0] > 2) {
    return { valid: false, detail: `First heading is H${headings[0]}, expected H1 or H2` };
  }
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      return { valid: false, detail: `Heading level jumps from H${headings[i - 1]} to H${headings[i]}` };
    }
  }
  return { valid: true, detail: `${headings.length} headings in proper hierarchy` };
}
function longParagraphRatio(text) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return 0;
  const long = paragraphs.filter((p) => wordCount(p) > 150).length;
  return long / paragraphs.length;
}
function trigramSet(text) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const set = /* @__PURE__ */ new Set();
  for (let i = 0; i <= words.length - 3; i++) {
    set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return set;
}
function trigramOverlap(textA, textB) {
  const setA = trigramSet(textA);
  const setB = trigramSet(textB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const tri of setA) {
    if (setB.has(tri)) shared++;
  }
  return shared / Math.min(setA.size, setB.size);
}
function gradeFromScore2(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}
function scoreContent(entity, content) {
  const checks = [];
  let total = 0;
  const wc = wordCount(content);
  const wcScore = wc >= 300 ? 20 : wc >= 150 ? 12 : wc >= 50 ? 6 : 0;
  checks.push({
    label: "Word count (300+ target)",
    score: wcScore,
    maxScore: 20,
    passed: wcScore >= 12,
    detail: `${wc} words`
  });
  total += wcScore;
  const fk = fleschKincaid(content);
  const readScore = fk >= 40 && fk <= 70 ? 20 : fk >= 30 && fk <= 80 ? 14 : fk > 0 ? 8 : 0;
  checks.push({
    label: "Readability (Flesch 40-70)",
    score: readScore,
    maxScore: 20,
    passed: readScore >= 14,
    detail: `Flesch score: ${fk}`
  });
  total += readScore;
  const headingCheck = checkHeadingHierarchy(content);
  const headingScore = headingCheck.valid ? 20 : 5;
  checks.push({
    label: "Heading hierarchy",
    score: headingScore,
    maxScore: 20,
    passed: headingCheck.valid,
    detail: headingCheck.detail
  });
  total += headingScore;
  const longRatio = longParagraphRatio(content);
  const paraScore = longRatio <= 0.1 ? 15 : longRatio <= 0.3 ? 10 : 5;
  checks.push({
    label: "Paragraph length (no walls of text)",
    score: paraScore,
    maxScore: 15,
    passed: paraScore >= 10,
    detail: `${Math.round(longRatio * 100)}% of paragraphs are 150+ words`
  });
  total += paraScore;
  const title = entity.metadata.title ?? "";
  const titleLen = title.length;
  const titleKeywordFirst = entity.seedKeyword ? title.toLowerCase().startsWith(entity.seedKeyword.toLowerCase()) : false;
  const titleScore = (titleLen >= 30 && titleLen <= 60 ? 8 : titleLen > 10 ? 4 : 0) + (titleKeywordFirst ? 7 : entity.seedKeyword && title.toLowerCase().includes(entity.seedKeyword.toLowerCase()) ? 4 : 0);
  checks.push({
    label: "Title quality (30-60 chars, keyword-first)",
    score: Math.min(titleScore, 15),
    maxScore: 15,
    passed: titleScore >= 10,
    detail: `${titleLen} chars${titleKeywordFirst ? ", keyword-first" : ""}`
  });
  total += Math.min(titleScore, 15);
  const desc = entity.metadata.description ?? "";
  const descLen = desc.length;
  const descScore = descLen >= 120 && descLen <= 160 ? 10 : descLen >= 50 ? 6 : descLen > 0 ? 3 : 0;
  checks.push({
    label: "Meta description (120-160 chars)",
    score: descScore,
    maxScore: 10,
    passed: descScore >= 6,
    detail: `${descLen} chars`
  });
  total += descScore;
  return {
    slug: entity.slug,
    name: entity.name,
    overallScore: total,
    grade: gradeFromScore2(total),
    checks
  };
}
function scoreAllContent(entities, contentMap) {
  const results = entities.map((entity) => {
    const content = contentMap.get(entity.slug) ?? "";
    return scoreContent(entity, content);
  });
  const avg = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length) : 0;
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    entityCount: results.length,
    averageScore: avg,
    averageGrade: gradeFromScore2(avg),
    entities: results
  };
}

// src/core/keywords.ts
var HIGH_VOLUME_MODIFIERS = /\b(?:best|top|free|cheap|review|how to|what is)\b/i;
var MEDIUM_VOLUME_MODIFIERS = /\b(?:vs|alternative|comparison|pricing|cost)\b/i;
var LONG_TAIL_THRESHOLD = 4;
function estimateVolume(name) {
  const wordCount2 = name.split(/\s+/).length;
  let base = 1e3;
  if (wordCount2 <= 2) base = 5e3;
  else if (wordCount2 <= 3) base = 2e3;
  else if (wordCount2 >= LONG_TAIL_THRESHOLD) base = 500;
  if (HIGH_VOLUME_MODIFIERS.test(name)) base = Math.round(base * 1.5);
  else if (MEDIUM_VOLUME_MODIFIERS.test(name)) base = Math.round(base * 1.2);
  const variance = name.length * 17 % 300;
  return base + variance;
}
var HIGH_COMPETITION_TERMS = /\b(?:software|platform|tool|app|crm|erp|saas)\b/i;
function estimateDifficulty(name) {
  const wordCount2 = name.split(/\s+/).length;
  if (wordCount2 >= LONG_TAIL_THRESHOLD) return "easy";
  if (HIGH_COMPETITION_TERMS.test(name) && wordCount2 <= 2) return "hard";
  if (MEDIUM_VOLUME_MODIFIERS.test(name)) return "medium";
  return wordCount2 <= 2 ? "hard" : "medium";
}
function estimateCpc(intent) {
  switch (intent) {
    case "commercial":
      return "$2.50-5.00";
    case "comparison":
      return "$1.50-3.50";
    case "segmented":
      return "$1.00-2.50";
    case "informational":
      return "$0.30-1.00";
  }
}
function calculateOpportunity(volume, difficulty, intent) {
  const difficultyMultiplier = difficulty === "easy" ? 1 : difficulty === "medium" ? 0.7 : 0.4;
  const intentMultiplier = intent === "commercial" ? 1 : intent === "comparison" ? 0.85 : intent === "segmented" ? 0.7 : 0.5;
  const volumeScore = Math.min(50, Math.round(volume / 5e3 * 50));
  const compositeScore = Math.round(volumeScore * difficultyMultiplier * intentMultiplier * 2);
  return Math.min(100, Math.max(0, compositeScore));
}
function analyzeKeyword(entity) {
  const { intent } = classifyIntent(entity.name);
  const volume = estimateVolume(entity.name);
  const difficulty = estimateDifficulty(entity.name);
  return {
    keyword: entity.name,
    slug: entity.slug,
    estimatedMonthlyVolume: volume,
    difficulty,
    intent,
    cpcEstimate: estimateCpc(intent),
    opportunityScore: calculateOpportunity(volume, difficulty, intent)
  };
}
function analyzeKeywords(entities) {
  return entities.map(analyzeKeyword).sort((a, b) => b.opportunityScore - a.opportunityScore);
}

// src/core/blog.ts
import path9 from "path";
var TOPIC_TEMPLATES = {
  commercial: [
    {
      titleTemplate: "Is {name} Worth It? Honest Review ({year})",
      sections: ["What it does", "Key features", "Pricing breakdown", "Who should use it", "Final verdict"]
    },
    {
      titleTemplate: "How to Choose the Right {seed}: A Buyer's Guide",
      sections: ["What to look for", "Must-have features", "Common pitfalls", "Price ranges", "Our recommendation"]
    }
  ],
  comparison: [
    {
      titleTemplate: "{name}: Which One Wins? (Detailed Comparison)",
      sections: ["Overview of each option", "Feature comparison table", "Pricing comparison", "Use case fit", "Bottom line"]
    },
    {
      titleTemplate: "Switching from {name}? What You Need to Know",
      sections: ["Why people switch", "Migration considerations", "Feature gaps", "Cost impact", "Transition checklist"]
    }
  ],
  segmented: [
    {
      titleTemplate: "How {name} Solves Real Problems ({year})",
      sections: ["Common pain points", "How the solution helps", "Implementation guide", "Results to expect", "Getting started"]
    },
    {
      titleTemplate: "{name}: Success Stories and Lessons Learned",
      sections: ["Background", "Challenges faced", "Solution approach", "Outcomes", "Key takeaways"]
    }
  ],
  informational: [
    {
      titleTemplate: "What Is {name}? Everything You Need to Know",
      sections: ["Definition", "How it works", "Key benefits", "Common use cases", "FAQ"]
    },
    {
      titleTemplate: "The Complete Guide to {name} ({year})",
      sections: ["Introduction", "Core concepts", "Step-by-step walkthrough", "Tips and best practices", "Resources"]
    }
  ]
};
function buildOutlinesForEntity(entity, postsPerEntity) {
  const { intent } = classifyIntent(entity.name);
  const templates = TOPIC_TEMPLATES[intent];
  const year = (/* @__PURE__ */ new Date()).getFullYear().toString();
  const seed = entity.seedKeyword ?? entity.name.split(/\s+/).slice(0, 2).join(" ");
  return templates.slice(0, postsPerEntity).map((template, index) => {
    const title = template.titleTemplate.replaceAll("{name}", entity.name).replaceAll("{seed}", seed).replaceAll("{year}", year);
    const slug = `blog/${entity.slug}-${index + 1}`;
    return {
      slug,
      parentEntity: entity.slug,
      title,
      intent,
      sections: template.sections,
      internalLinks: [`/${entity.slug}`],
      targetKeywords: [entity.name, ...entity.metadata.tags ?? []]
    };
  });
}
function generateBlogOutlines(entities, postsPerEntity = 2) {
  return entities.flatMap((entity) => buildOutlinesForEntity(entity, postsPerEntity));
}
async function blog(options) {
  const outputRoot = options.output ?? path9.join("data", "blog");
  const postsPerEntity = options.postsPerEntity ?? 2;
  const outlines = generateBlogOutlines(options.entities, postsPerEntity);
  await writeGeneratedFile(
    path9.join(outputRoot, "blog-outlines.json"),
    `${JSON.stringify(outlines, null, 2)}
`
  );
  console.log(`Blog outlines generated: ${outlines.length} posts for ${options.entities.length} entities`);
  return outlines;
}
export {
  DEFAULT_PATTERNS,
  analyzeAll,
  analyzeEntity,
  analyzeKeyword,
  analyzeKeywords,
  applyAutoFixes,
  assertSafePath,
  astro,
  audit,
  blog,
  buildFaqSchema,
  buildMetricsFromRows,
  calculateScore,
  classifyIntent,
  countAiPatterns,
  discover,
  enrich,
  fetchGSCData,
  filterMappedEntities,
  filterUnmappedEntities,
  fleschKincaid,
  generate,
  generateBlogOutlines,
  generateRecommendations,
  getSections,
  gradeFromScore,
  humanize,
  humanizeContent,
  isSophonFile,
  loadEnrichedContent,
  mapEntitiesToGSC,
  nextjs,
  nuxt,
  optimize,
  propose,
  remix,
  renderSections,
  renderYmylDisclaimer,
  safeJsonStringify,
  scoreAllContent,
  scoreContent,
  scoreEntities,
  slugify,
  stableHash,
  sveltekit,
  teach,
  technical,
  trigramOverlap
};
//# sourceMappingURL=index.mjs.map