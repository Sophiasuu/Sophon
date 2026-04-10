#!/usr/bin/env node

// src/cli.ts
import { readFile as readFile3 } from "fs/promises";
import path4 from "path";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { parseArgs } from "util";

// src/core/discover.ts
import { readFile } from "fs/promises";
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
  return line.split(",").map((column) => column.trim()).filter(Boolean);
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

// src/core/enrich.ts
import path2 from "path";
import Anthropic from "@anthropic-ai/sdk";

// src/core/generate.ts
import { mkdir, readFile as readFile2, writeFile } from "fs/promises";
import path from "path";

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
  </head>
  <body>
    <main>
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
      <section>
        <h2>TODO: Intro paragraph</h2>
        <p>Replace with grounded introductory content for {entity.name}.</p>
      </section>
      <section>
        <h2>TODO: FAQ section</h2>
        <p>Add sourced FAQ content before publishing.</p>
      </section>
      <section>
        <h2>TODO: Comparison section</h2>
        <p>Add evidence-based comparisons only after validating claims.</p>
      </section>
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
};

export const dynamic = "force-static";

export default function SophonPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-16">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Sophon generated page</p>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-950">{entity.title}</h1>
        <p className="max-w-3xl text-base leading-7 text-neutral-700">{entity.description}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-8 rounded-3xl border border-neutral-200 p-8">
          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: Intro paragraph</h2>
            <p className="text-neutral-700">Replace with grounded introductory content for {entity.name}.</p>
          </section>

          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: FAQ section</h2>
            <p className="text-neutral-700">Add sourced FAQ content before publishing.</p>
          </section>

          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: Comparison section</h2>
            <p className="text-neutral-700">Add evidence-based comparisons only after validating claims.</p>
          </section>
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
  meta: [{ name: "description", content: entity.description }],
  link: [{ rel: "canonical", href: "/" + entity.slug }],
});
</script>

<template>
  <main>
    <h1>{{ entity.title }}</h1>
    <p>{{ entity.description }}</p>
    <section>
      <h2>TODO: Intro paragraph</h2>
      <p>Replace with grounded introductory content for {{ entity.name }}.</p>
    </section>
    <section>
      <h2>TODO: FAQ section</h2>
      <p>Add sourced FAQ content before publishing.</p>
    </section>
    <section>
      <h2>TODO: Comparison section</h2>
      <p>Add evidence-based comparisons only after validating claims.</p>
    </section>
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
  ];
};

export default function SophonPage() {
  return (
    <main>
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
      <section>
        <h2>TODO: Intro paragraph</h2>
        <p>Replace with grounded introductory content for {entity.name}.</p>
      </section>
      <section>
        <h2>TODO: FAQ section</h2>
        <p>Add sourced FAQ content before publishing.</p>
      </section>
      <section>
        <h2>TODO: Comparison section</h2>
        <p>Add evidence-based comparisons only after validating claims.</p>
      </section>
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
</svelte:head>

<main>
  <h1>{data.entity.title}</h1>
  <p>{data.entity.description}</p>

  <section>
    <h2>TODO: Intro paragraph</h2>
    <p>Replace with grounded introductory content for {data.entity.name}.</p>
  </section>

  <section>
    <h2>TODO: FAQ section</h2>
    <p>Add sourced FAQ content before publishing.</p>
  </section>

  <section>
    <h2>TODO: Comparison section</h2>
    <p>Add evidence-based comparisons only after validating claims.</p>
  </section>

  <pre>{JSON.stringify({ tags: data.entity.tags, attributes: data.entity.attributes }, null, 2)}</pre>
</main>
`;
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
var TODO_SECTIONS_PER_PAGE = 3;
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
      return path.join("src", "pages");
    case "nuxt":
      return "pages";
    case "sveltekit":
      return path.join("src", "routes");
    case "remix":
      return path.join("app", "routes");
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
function hydrateTemplate(template, entity) {
  return Object.entries(buildHydrationMap(entity)).reduce((content, [placeholder, value]) => {
    return content.replaceAll(placeholder, value);
  }, template);
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
      return path.join(outputRoot, slug, "page.tsx");
    case "astro":
      return path.join(outputRoot, `${slug}.astro`);
    case "nuxt":
      return path.join(outputRoot, `${slug}.vue`);
    case "sveltekit":
      return path.join(outputRoot, slug, "+page.svelte");
    case "remix":
      return path.join(outputRoot, `${slug}.tsx`);
  }
}
function buildAdditionalFiles(framework, outputRoot, entity) {
  if (framework !== "sveltekit") {
    return [];
  }
  return [
    {
      filePath: path.join(outputRoot, entity.slug, "+page.ts"),
      content: hydrateTemplate(buildSvelteKitPageModule(), entity)
    }
  ];
}
function prependCommentBlock(framework, content) {
  return `${COMMENT_BLOCKS[framework]}${content}`;
}
async function writeGeneratedFile(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  console.log(`Generated file -> ${filePath}`);
}
async function generate(options) {
  const outputRoot = options.output ?? defaultOutputRoot(options.framework);
  const customTemplate = options.template ? await readFile2(options.template, "utf8") : void 0;
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
    const pageContent = customTemplate ? prependCommentBlock(options.framework, hydrateTemplate(template, entity)) : hydrateTemplate(template, entity);
    const pagePath = buildMainPagePath(options.framework, outputRoot, entity.slug);
    await writeGeneratedFile(pagePath, pageContent);
    for (const file of buildAdditionalFiles(options.framework, outputRoot, entity)) {
      await writeGeneratedFile(file.filePath, prependCommentBlock(options.framework, file.content));
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

// src/core/enrich.ts
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
  const outputRoot = options.output ?? path2.join("data", "enriched");
  const client = new Anthropic({ apiKey });
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
        path2.join(outputRoot, entity.slug, "content.json"),
        `${JSON.stringify(parsed, null, 2)}
`
      );
    } catch (error) {
      console.error(`Enrichment failed for ${entity.slug}:`, error instanceof Error ? error.message : error);
    }
  }
}

// src/core/technical.ts
import path3 from "path";
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
  const technicalRoot = path3.join(outputRoot, "sophon");
  const sitemap = buildSitemap(siteUrl, options.entities);
  const robots = buildRobots(siteUrl);
  const schema = buildSchema(siteUrl, options.entities);
  const internalLinks = buildInternalLinks(options.entities);
  await Promise.all([
    writeGeneratedFile(path3.join(outputRoot, "sitemap.xml"), sitemap),
    writeGeneratedFile(path3.join(outputRoot, "robots.txt"), robots),
    writeGeneratedFile(path3.join(technicalRoot, "schema.json"), `${JSON.stringify(schema, null, 2)}
`),
    writeGeneratedFile(
      path3.join(technicalRoot, "internal-links.json"),
      `${JSON.stringify(internalLinks, null, 2)}
`
    )
  ]);
  console.log(`sitemap.xml -> ${options.entities.length} URLs`);
  console.log(`schema.json -> ${schema.length} records`);
  console.log(`internal-links.json -> ${internalLinks.length} nodes`);
}

// src/cli.ts
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function asStringArray(values) {
  return (values ?? []).filter((value) => typeof value === "string");
}
function parseCli() {
  return parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      seed: { type: "string" },
      csv: { type: "string" },
      output: { type: "string" },
      entities: { type: "string" },
      "discover-output": { type: "string" },
      "generate-output": { type: "string" },
      "technical-output": { type: "string" },
      "enrich-output": { type: "string" },
      pattern: { type: "string", multiple: true },
      patterns: { type: "string", multiple: true },
      framework: { type: "string" },
      template: { type: "string" },
      site: { type: "string" },
      "title-template": { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    strict: false
  });
}
function defaultOutputRoot2(framework) {
  switch (framework) {
    case "nextjs":
      return "app";
    case "astro":
      return path4.join("src", "pages");
    case "nuxt":
      return "pages";
    case "sveltekit":
      return path4.join("src", "routes");
    case "remix":
      return path4.join("app", "routes");
  }
}
async function readJsonIfExists(filePath) {
  try {
    const raw = await readFile3(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return void 0;
  }
}
async function detectFramework() {
  const packageJson = await readJsonIfExists(path4.join(process.cwd(), "package.json"));
  const dependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies
  };
  if (dependencies.next) {
    return "nextjs";
  }
  if (dependencies.astro) {
    return "astro";
  }
  if (dependencies.nuxt) {
    return "nuxt";
  }
  if (dependencies["@sveltejs/kit"]) {
    return "sveltekit";
  }
  if (dependencies["@remix-run/react"] || dependencies["@remix-run/node"]) {
    return "remix";
  }
  return void 0;
}
async function promptFramework() {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question("Select a framework (nextjs, astro, nuxt, sveltekit, remix): ");
    const framework = answer.trim().toLowerCase();
    if (["nextjs", "astro", "nuxt", "sveltekit", "remix"].includes(framework)) {
      return framework;
    }
    throw new Error("Unsupported framework selection.");
  } finally {
    rl.close();
  }
}
async function resolveFramework(value) {
  if (value) {
    return value;
  }
  const config = await readConfig();
  if (config?.framework) {
    return config.framework;
  }
  return await detectFramework() ?? promptFramework();
}
async function readConfig() {
  const config = await readJsonIfExists(path4.join(process.cwd(), "sophon.config.json"));
  return config;
}
async function loadDiscoverResult(filePath) {
  const raw = await readFile3(filePath, "utf8");
  return JSON.parse(raw);
}
async function initCommand(values) {
  const framework = await resolveFramework(asString(values.framework));
  const config = {
    framework,
    entitiesPath: path4.join("data", "entities.json"),
    pagesOutput: defaultOutputRoot2(framework),
    technicalOutput: "public",
    enrichOutput: path4.join("data", "enriched")
  };
  await writeGeneratedFile(
    path4.join(process.cwd(), "sophon.config.json"),
    `${JSON.stringify(config, null, 2)}
`
  );
}
async function discoverCommand(values) {
  const result = await discover({
    csv: asString(values.csv),
    seed: asString(values.seed),
    output: asString(values["discover-output"]) ?? asString(values.output),
    titleTemplate: asString(values["title-template"]),
    patterns: [...asStringArray(values.pattern), ...asStringArray(values.patterns)]
  });
  const outputPath = asString(values["discover-output"]) ?? asString(values.output) ?? path4.join("data", "entities.json");
  await writeGeneratedFile(outputPath, `${JSON.stringify(result, null, 2)}
`);
  return result;
}
async function generateCommand(values) {
  const config = await readConfig();
  const entitiesPath = asString(values.entities) ?? config?.entitiesPath ?? path4.join("data", "entities.json");
  const payload = await loadDiscoverResult(entitiesPath);
  const framework = await resolveFramework(asString(values.framework));
  await generate({
    entities: payload.entities,
    framework,
    output: asString(values["generate-output"]) ?? asString(values.output) ?? config?.pagesOutput,
    template: asString(values.template)
  });
}
async function technicalCommand(values) {
  const config = await readConfig();
  const entitiesPath = asString(values.entities) ?? config?.entitiesPath ?? path4.join("data", "entities.json");
  const payload = await loadDiscoverResult(entitiesPath);
  const site = asString(values.site);
  if (!site) {
    throw new Error("--site is required for the technical command.");
  }
  await technical({
    entities: payload.entities,
    site,
    output: asString(values["technical-output"]) ?? asString(values.output) ?? config?.technicalOutput
  });
}
async function enrichCommand(values) {
  const config = await readConfig();
  const entitiesPath = asString(values.entities) ?? config?.entitiesPath ?? path4.join("data", "entities.json");
  const payload = await loadDiscoverResult(entitiesPath);
  await enrich({
    entities: payload.entities,
    output: asString(values["enrich-output"]) ?? asString(values.output) ?? config?.enrichOutput
  });
}
async function runCommand(values) {
  const config = await readConfig();
  const framework = await resolveFramework(asString(values.framework));
  const discoverOutput = asString(values["discover-output"]) ?? asString(values.output) ?? config?.entitiesPath ?? path4.join("data", "entities.json");
  const generateOutput = asString(values["generate-output"]) ?? config?.pagesOutput ?? defaultOutputRoot2(framework);
  const technicalOutput = asString(values["technical-output"]) ?? config?.technicalOutput ?? "public";
  const enrichOutput = asString(values["enrich-output"]) ?? config?.enrichOutput ?? path4.join("data", "enriched");
  console.log("Running discover...");
  const result = await discover({
    csv: asString(values.csv),
    seed: asString(values.seed),
    output: discoverOutput,
    titleTemplate: asString(values["title-template"]),
    patterns: [...asStringArray(values.pattern), ...asStringArray(values.patterns)]
  });
  await writeGeneratedFile(discoverOutput, `${JSON.stringify(result, null, 2)}
`);
  console.log("Running generate...");
  await generate({
    entities: result.entities,
    framework,
    output: generateOutput,
    template: asString(values.template)
  });
  const site = asString(values.site);
  if (!site) {
    throw new Error("--site is required for the run command.");
  }
  console.log("Running technical...");
  await technical({
    entities: result.entities,
    site,
    output: technicalOutput
  });
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("Skipping enrich: ANTHROPIC_API_KEY is not set.");
    return;
  }
  console.log("Running enrich...");
  await enrich({
    entities: result.entities,
    output: enrichOutput
  });
}
function printHelp() {
  console.log(`sophon <command>

Commands:
  sophon init
  sophon discover --seed "keyword" | --csv ./file.csv
  sophon generate --framework nextjs
  sophon technical --site https://example.com
  sophon enrich
  sophon run --seed "keyword" --framework nextjs --site https://example.com

Common flags:
  --entities <path>
  --discover-output <path>
  --generate-output <path>
  --technical-output <path>
  --enrich-output <path>`);
}
async function main() {
  const parsed = parseCli();
  const command = parsed.positionals[0];
  if (parsed.values.help || !command) {
    printHelp();
    return;
  }
  switch (command) {
    case "init":
      await initCommand(parsed.values);
      return;
    case "discover":
      await discoverCommand(parsed.values);
      return;
    case "generate":
      await generateCommand(parsed.values);
      return;
    case "technical":
      await technicalCommand(parsed.values);
      return;
    case "enrich":
      await enrichCommand(parsed.values);
      return;
    case "run":
      await runCommand(parsed.values);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
//# sourceMappingURL=cli.mjs.map