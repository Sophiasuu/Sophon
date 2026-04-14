import path from "node:path";

import { loadEnrichedContent, writeGeneratedFile } from "./generate";
import { classifyIntent } from "./intent";
import type { EnrichedFaq, EntityRecord, TechnicalOptions } from "../types";

type InternalLinkRecord = {
  entity: string;
  relatedEntities: Array<{ slug: string; reason: string }>;
};

type SchemaRecord = {
  "@context": "https://schema.org";
  "@type": string;
  name: string;
  description: string;
  url: string;
};

type FaqSchemaRecord = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }>;
};

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Intent-aware sitemap priority ──────────────────────────

function sitemapPriority(entity: EntityRecord): string {
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

function sitemapChangefreq(entity: EntityRecord): string {
  const { intent } = classifyIntent(entity.name);
  return intent === "commercial" || intent === "comparison" ? "weekly" : "monthly";
}

export function buildSitemap(siteUrl: string, entities: EntityRecord[]): string {
  const lastmod = todayDate();
  const urls = entities
    .map(
      (entity) =>
        `  <url>\n    <loc>${siteUrl}/${entity.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${sitemapChangefreq(entity)}</changefreq>\n    <priority>${sitemapPriority(entity)}</priority>\n  </url>`,
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

// ── Intent-based linking rules ─────────────────────────────
// commercial → comparison (show evaluation content)
// comparison → commercial (lead to buying pages)
// segmented → commercial (audience → product)
// informational → segmented (educate → narrow audience)

const INTENT_AFFINITY: Record<string, string[]> = {
  commercial: ["comparison", "segmented"],
  comparison: ["commercial", "comparison"],
  segmented: ["commercial", "informational"],
  informational: ["segmented", "commercial"],
};

function relatedScore(entity: EntityRecord, candidate: EntityRecord): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Same seed keyword is a strong signal
  if (entity.seedKeyword && candidate.seedKeyword && entity.seedKeyword === candidate.seedKeyword) {
    score += 3;
    reasons.push("same seed");
  }

  // Tag overlap
  const tagCount = countSharedTags(entity, candidate);
  if (tagCount > 0) {
    score += tagCount * 2;
    reasons.push(`${tagCount} shared tags`);
  }

  // Intent affinity bonus
  const entityIntent = classifyIntent(entity.name).intent;
  const candidateIntent = classifyIntent(candidate.name).intent;
  const preferredIntents = INTENT_AFFINITY[entityIntent] ?? [];

  if (preferredIntents.includes(candidateIntent)) {
    score += 4;
    reasons.push(`${entityIntent}→${candidateIntent} affinity`);
  }

  // Word overlap in entity names (topical relevance)
  const entityWords = new Set(entity.name.toLowerCase().split(/\s+/));
  const candidateWords = candidate.name.toLowerCase().split(/\s+/);
  const overlap = candidateWords.filter((w) => entityWords.has(w) && w.length > 3).length;
  if (overlap > 0) {
    score += overlap;
    reasons.push(`${overlap} word overlap`);
  }

  return { score, reason: reasons.join(", ") || "none" };
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
      .map((candidate) => {
        const { score, reason } = relatedScore(entity, candidate);
        return { slug: candidate.slug, score, reason };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug))
      .slice(0, 5)
      .map((candidate) => ({ slug: candidate.slug, reason: candidate.reason })),
  }));
}

// ── FAQ Schema ─────────────────────────────────────────────

export function buildFaqSchema(entity: EntityRecord, enrichedFaqs?: EnrichedFaq[]): FaqSchemaRecord | null {
  if (enrichedFaqs && enrichedFaqs.length > 0) {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: enrichedFaqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    };
  }

  // Without enriched content, do not generate FAQ schema
  // (hardcoded template answers are penalized by search engines)
  return null;
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

  // Build FAQ schemas only from enriched content (no hardcoded stubs)
  const faqSchemas: Array<{ slug: string; faq: FaqSchemaRecord }> = [];
  for (const entity of options.entities) {
    const enriched = await loadEnrichedContent(entity.slug);
    const faq = buildFaqSchema(entity, enriched?.content?.faqs);
    if (faq) {
      faqSchemas.push({ slug: entity.slug, faq });
    }
  }

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
    faqSchemas.length > 0
      ? writeGeneratedFile(
          path.join(technicalRoot, "faq-schema.json"),
          `${JSON.stringify(faqSchemas, null, 2)}\n`,
          { force: options.force },
        )
      : Promise.resolve(),
  ]);

  console.log(`sitemap.xml -> ${options.entities.length} URLs`);
  console.log(`schema.json -> ${schema.length} records`);
  console.log(`faq-schema.json -> ${faqSchemas.length} FAQ pages`);
  console.log(`internal-links.json -> ${internalLinks.length} nodes`);
  console.log(`hreflang.txt -> ${options.entities.length} entity scaffolds`);
}