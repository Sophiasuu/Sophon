import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DiscoverResult, EntityRecord } from "../types";

type InternalLinkRecord = {
  entity: string;
  relatedEntities: string[];
};

type SchemaRecord = {
  "@context": "https://schema.org";
  "@type": string;
  name: string;
  description: string;
  url: string;
};

type TechnicalSummary = {
  sitemapUrls: number;
  schemaRecords: number;
  internalLinkNodes: number;
  outputRoot: string;
};

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadEntities(filePath: string): Promise<DiscoverResult> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as DiscoverResult;
}

function buildSitemap(siteUrl: string, entities: EntityRecord[], lastModifiedDate: string): string {
  const urls = entities
    .map(
      (entity) =>
        `  <url>\n    <loc>${siteUrl}/${entity.slug}</loc>\n    <lastmod>${lastModifiedDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join("\n");
}

function buildRobots(siteUrl: string): string {
  return [
    `# Sophon generated - review before deploying to production`,
    `# Consider disallowing /sophon/*.json if raw generated data should not be publicly crawlable.`,
    `User-agent: *`,
    `Allow: /`,
    ``,
    `Sitemap: ${siteUrl}/sitemap.xml`,
    ``,
  ].join("\n");
}

function inferSchemaType(entity: EntityRecord): SchemaRecord["@type"] {
  const searchText = [
    entity.name,
    entity.seedKeyword ?? "",
    entity.metadata.title ?? "",
    entity.metadata.description ?? "",
    ...(entity.metadata.tags ?? []),
    ...Object.values(entity.metadata.attributes ?? {}),
  ]
    .join(" ")
    .toLowerCase();

  if (/(software|saas|app|platform|tool)/.test(searchText)) {
    return "SoftwareApplication";
  }

  if (/(product|pricing|price|buy|shop|ecommerce|sku)/.test(searchText)) {
    return "Product";
  }

  if (/(restaurant|agency|clinic|dentist|attorney|lawyer|plumber|electrician|hotel|near me|local)/.test(searchText)) {
    return "LocalBusiness";
  }

  if (/(faq|questions)/.test(searchText)) {
    return "FAQPage";
  }

  return "Article";
}

function buildSchema(siteUrl: string, entities: EntityRecord[]): SchemaRecord[] {
  return entities.map((entity) => ({
    "@context": "https://schema.org",
    "@type": inferSchemaType(entity),
    name: entity.metadata.title ?? entity.name,
    description: entity.metadata.description ?? `SEO landing page for ${entity.name}.`,
    url: `${siteUrl}/${entity.slug}`,
  }));
}

function countSharedTags(entity: EntityRecord, candidate: EntityRecord): number {
  const entityTags = new Set((entity.metadata.tags ?? []).map((tag) => tag.toLowerCase()));

  return (candidate.metadata.tags ?? []).reduce((count, tag) => {
    return entityTags.has(tag.toLowerCase()) ? count + 1 : count;
  }, 0);
}

function scoreRelatedEntity(entity: EntityRecord, candidate: EntityRecord): number {
  let score = 0;

  if (entity.seedKeyword && candidate.seedKeyword && entity.seedKeyword === candidate.seedKeyword) {
    score += 3;
  }

  score += countSharedTags(entity, candidate) * 2;

  return score;
}

function buildInternalLinks(entities: EntityRecord[]): InternalLinkRecord[] {
  return entities.map((entity) => {
    const relatedEntities = entities
      .filter((candidate) => candidate.slug !== entity.slug)
      .map((candidate) => ({
        candidate,
        score: scoreRelatedEntity(entity, candidate),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))
      .slice(0, 3)
      .map((candidate) => candidate.candidate.slug);

    return {
      entity: entity.slug,
      relatedEntities,
    };
  });
}

async function writeGeneratedFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  console.log(`Generated file -> ${filePath}`);
}

function logSummary(summary: TechnicalSummary): void {
  console.log(`sitemap.xml -> ${summary.sitemapUrls} URLs`);
  console.log(`schema.json -> ${summary.schemaRecords} records`);
  console.log(`internal-links.json -> ${summary.internalLinkNodes} nodes`);
  console.log(
    JSON.stringify(
      {
        outputRoot: summary.outputRoot,
        sitemapUrls: summary.sitemapUrls,
        schemaRecords: summary.schemaRecords,
        internalLinkNodes: summary.internalLinkNodes,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const entitiesPath = getArg("--entities") ?? path.join("data", "entities.json");
  const outputRoot = getArg("--output") ?? "public";
  const siteUrl = (getArg("--site") ?? "https://example.com").replace(/\/$/, "");
  const technicalRoot = path.join(outputRoot, "sophon");
  const lastModifiedDate = new Date().toISOString().split("T")[0];

  const payload = await loadEntities(entitiesPath);
  const entities = payload.entities;
  await mkdir(technicalRoot, { recursive: true });

  const sitemap = buildSitemap(siteUrl, entities, lastModifiedDate);
  const robots = buildRobots(siteUrl);
  const schema = buildSchema(siteUrl, entities);
  const internalLinks = buildInternalLinks(entities);

  await Promise.all([
    writeGeneratedFile(path.join(outputRoot, "sitemap.xml"), sitemap),
    writeGeneratedFile(path.join(outputRoot, "robots.txt"), robots),
    writeGeneratedFile(path.join(technicalRoot, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`),
    writeGeneratedFile(
      path.join(technicalRoot, "internal-links.json"),
      `${JSON.stringify(internalLinks, null, 2)}\n`,
    ),
  ]);

  // TODO: Support projects that generate sitemap and robots files through Next.js metadata routes.
  // TODO: Replace the heuristic schema inference with niche-specific presets or provider-backed classification.

  logSummary({
    outputRoot,
    sitemapUrls: entities.length,
    schemaRecords: schema.length,
    internalLinkNodes: internalLinks.length,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});