import path from "node:path";

import { writeGeneratedFile } from "./generate";
import type { EntityRecord, TechnicalOptions } from "../types";

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

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function buildSitemap(siteUrl: string, entities: EntityRecord[]): string {
  const lastmod = todayDate();
  const urls = entities
    .map(
      (entity) =>
        `  <url>\n    <loc>${siteUrl}/${entity.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

export function buildRobots(siteUrl: string): string {
  return [
    "# Sophon generated — review before deploying to production",
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

function inferSchemaType(entity: EntityRecord): string {
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

export function buildSchema(siteUrl: string, entities: EntityRecord[]): SchemaRecord[] {
  return entities.map((entity) => ({
    "@context": "https://schema.org",
    "@type": inferSchemaType(entity),
    name: entity.metadata.title ?? entity.name,
    description: entity.metadata.description ?? `SEO landing page for ${entity.name}.`,
    url: `${siteUrl}/${entity.slug}`,
  }));
}

function countSharedTags(left: EntityRecord, right: EntityRecord): number {
  const leftTags = new Set((left.metadata.tags ?? []).map((tag) => tag.toLowerCase()));

  return (right.metadata.tags ?? []).reduce((count, tag) => {
    return leftTags.has(tag.toLowerCase()) ? count + 1 : count;
  }, 0);
}

function relatedScore(entity: EntityRecord, candidate: EntityRecord): number {
  let score = 0;

  if (entity.seedKeyword && candidate.seedKeyword && entity.seedKeyword === candidate.seedKeyword) {
    score += 3;
  }

  score += countSharedTags(entity, candidate) * 2;
  return score;
}

export function buildHreflang(siteUrl: string, entities: EntityRecord[]): string {
  const lines = [
    "# SOPHON GENERATED — Hreflang scaffold",
    "# Add one <link rel=\"alternate\"> block per language/region variant per entity.",
    "# See: https://developers.google.com/search/docs/specialty/international/localization",
    "#",
    "# Example for a single entity (paste into your <head>):",
    "#",
    ...entities.slice(0, 3).map((e) =>
      [
        `# <!-- ${e.name} -->`,
        `# <link rel="alternate" hreflang="en" href="${siteUrl}/${e.slug}" />`,
        `# <link rel="alternate" hreflang="x-default" href="${siteUrl}/${e.slug}" />`,
        `# <!-- Add hreflang="de", "fr", etc. for each language variant -->`,
        "#",
      ].join("\n"),
    ),
    `# Total entities requiring hreflang coverage: ${entities.length}`,
    "",
  ].join("\n");

  return lines;
}

export function buildInternalLinks(entities: EntityRecord[]): InternalLinkRecord[] {
  return entities.map((entity) => ({
    entity: entity.slug,
    relatedEntities: entities
      .filter((candidate) => candidate.slug !== entity.slug)
      .map((candidate) => ({
        slug: candidate.slug,
        score: relatedScore(entity, candidate),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug))
      .slice(0, 3)
      .map((candidate) => candidate.slug),
  }));
}

export async function technical(options: TechnicalOptions): Promise<void> {
  const outputRoot = options.output ?? "public";
  const siteUrl = options.site.replace(/\/$/, "");
  const technicalRoot = path.join(outputRoot, "sophon");

  const sitemap = buildSitemap(siteUrl, options.entities);
  const robots = buildRobots(siteUrl);
  const schema = buildSchema(siteUrl, options.entities);
  const internalLinks = buildInternalLinks(options.entities);
  const hreflang = buildHreflang(siteUrl, options.entities);

  await Promise.all([
    writeGeneratedFile(path.join(outputRoot, "sitemap.xml"), sitemap, {
      force: options.force,
    }),
    writeGeneratedFile(path.join(outputRoot, "robots.txt"), robots, {
      force: options.force,
    }),
    writeGeneratedFile(path.join(technicalRoot, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`, {
      force: options.force,
    }),
    writeGeneratedFile(
      path.join(technicalRoot, "internal-links.json"),
      `${JSON.stringify(internalLinks, null, 2)}\n`,
      {
        force: options.force,
      },
    ),
    writeGeneratedFile(path.join(technicalRoot, "hreflang.txt"), hreflang, {
      force: options.force,
    }),
  ]);

  console.log(`sitemap.xml -> ${options.entities.length} URLs`);
  console.log(`schema.json -> ${schema.length} records`);
  console.log(`internal-links.json -> ${internalLinks.length} nodes`);
  console.log(`hreflang.txt -> ${options.entities.length} entity scaffolds`);
}