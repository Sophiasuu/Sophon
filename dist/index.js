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
  discover: () => discover,
  enrich: () => enrich,
  generate: () => generate,
  nextjs: () => nextjs,
  nuxt: () => nuxt,
  remix: () => remix,
  sveltekit: () => sveltekit,
  technical: () => technical
});
module.exports = __toCommonJS(src_exports);

// src/core/discover.ts
var import_promises = require("fs/promises");
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
      content: hydrateTemplate(buildSvelteKitPageModule(), entity)
    }
  ];
}
function prependCommentBlock(framework, content) {
  return `${COMMENT_BLOCKS[framework]}${content}`;
}
async function writeGeneratedFile(filePath, content) {
  await (0, import_promises2.mkdir)(import_node_path.default.dirname(filePath), { recursive: true });
  await (0, import_promises2.writeFile)(filePath, content, "utf8");
  console.log(`Generated file -> ${filePath}`);
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
  await Promise.all([
    writeGeneratedFile(import_node_path2.default.join(outputRoot, "sitemap.xml"), sitemap),
    writeGeneratedFile(import_node_path2.default.join(outputRoot, "robots.txt"), robots),
    writeGeneratedFile(import_node_path2.default.join(technicalRoot, "schema.json"), `${JSON.stringify(schema, null, 2)}
`),
    writeGeneratedFile(
      import_node_path2.default.join(technicalRoot, "internal-links.json"),
      `${JSON.stringify(internalLinks, null, 2)}
`
    )
  ]);
  console.log(`sitemap.xml -> ${options.entities.length} URLs`);
  console.log(`schema.json -> ${schema.length} records`);
  console.log(`internal-links.json -> ${internalLinks.length} nodes`);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PATTERNS,
  astro,
  discover,
  enrich,
  generate,
  nextjs,
  nuxt,
  remix,
  sveltekit,
  technical
});
//# sourceMappingURL=index.js.map