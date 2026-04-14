import { readFile } from "node:fs/promises";

import type { DiscoverMode, DiscoverOptions, DiscoverResult, EntityRecord } from "../types";
import { sanitizeCsvCell, slugify, stableHash } from "./utils";

export const DEFAULT_PATTERNS = [
  "{seed} for startups",
  "{seed} for small business",
  "{seed} for enterprises",
  "{seed} pricing",
  "{seed} alternatives",
  "best {seed}",
  "{seed} comparison",
];

function resolvePatterns(patterns?: string[]): string[] {
  return patterns && patterns.length > 0 ? patterns : DEFAULT_PATTERNS;
}

function buildEntityId(name: string): string {
  return stableHash(slugify(name));
}

// Title templates with keyword-first placement and power words.
// Selected based on entity name pattern to produce varied, SEO-friendly titles.
const TITLE_TEMPLATES: Array<{ pattern: RegExp; template: string }> = [
  { pattern: /\bpricing\b/i, template: "{name}: Plans, Costs & What to Expect" },
  { pattern: /\balternatives\b/i, template: "Top {name} Worth Trying in {year}" },
  { pattern: /\bcomparison\b|\bvs\b/i, template: "{name}: Features, Pros & Cons" },
  { pattern: /\bbest\b/i, template: "{name}: Reviewed and Ranked ({year})" },
  { pattern: /\bfor\s/i, template: "{name}: Complete Guide ({year})" },
  { pattern: /\bhow to\b/i, template: "{name} - Step by Step" },
  { pattern: /\bguide\b|\bchecklist\b/i, template: "{name} ({year} Edition)" },
];

const GENERIC_TITLES = [
  "{name}: What You Need to Know ({year})",
  "{name} - A Practical Overview ({year})",
  "{name}: Guide and Key Insights ({year})",
];

function titleCase(text: string): string {
  const minorWords = new Set(["a", "an", "the", "and", "but", "or", "for", "in", "on", "at", "to", "of", "by", "is"]);
  return text
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0 || !minorWords.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(" ");
}

function buildTitle(name: string, _source: DiscoverMode, titleTemplate?: string): string {
  if (titleTemplate) {
    return titleTemplate.replaceAll("{name}", titleCase(name));
  }

  const year = new Date().getFullYear().toString();
  const matched = TITLE_TEMPLATES.find((t) => t.pattern.test(name));
  const template = matched?.template ?? GENERIC_TITLES[name.length % GENERIC_TITLES.length];

  let title = template.replaceAll("{name}", titleCase(name)).replaceAll("{year}", year);

  // Truncate to ~60 chars cleanly if needed
  if (title.length > 65) {
    title = title.slice(0, 60).replace(/\s+\S*$/, "...");
  }

  return title;
}

function buildDescription(name: string, _source: DiscoverMode, seedKeyword?: string): string {
  const keyword = seedKeyword ? ` ${seedKeyword}` : "";
  const descriptions = [
    `Compare ${name} options and find the right${keyword} fit for your needs. Features, pricing, and honest reviews.`,
    `Everything you need to know about ${name}. Unbiased breakdown of features, use cases, and top picks for${keyword}.`,
    `Looking for the best ${name}? We cover key differences, real pros and cons, and practical recommendations.`,
  ];

  let desc = descriptions[name.length % descriptions.length];

  // Trim to 155 chars cleanly
  if (desc.length > 160) {
    desc = desc.slice(0, 155).replace(/\s+\S*$/, "...");
  }

  return desc;
}

function toEntity(
  name: string,
  source: DiscoverMode,
  options: {
    seedKeyword?: string;
    titleTemplate?: string;
    attributes?: Record<string, string>;
  } = {},
): EntityRecord {
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
      attributes: options.attributes,
      generatedAt: new Date().toISOString(),
    },
  };
}

function dedupeEntities(entities: EntityRecord[]): EntityRecord[] {
  const seen = new Set<string>();

  return entities.filter((entity) => {
    if (seen.has(entity.slug)) {
      return false;
    }

    seen.add(entity.slug);
    return true;
  });
}

function parseCsvRow(line: string): string[] {
  const columns: string[] = [];
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

function isHeaderRow(columns: string[]): boolean {
  return columns.some((column) => /name|entity|keyword/i.test(column));
}

function buildAttributes(headers: string[], columns: string[]): Record<string, string> | undefined {
  const attributes = columns.slice(1).reduce<Record<string, string>>((result, value, index) => {
    const key = headers[index + 1] ?? `column_${index + 2}`;

    result[key] = value;
    return result;
  }, {});

  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

async function discoverFromCsv(csvPath: string, titleTemplate?: string): Promise<EntityRecord[]> {
  const raw = await readFile(csvPath, "utf8");
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const firstRowColumns = parseCsvRow(rows[0]);
  const hasHeader = isHeaderRow(firstRowColumns);
  const headers = hasHeader
    ? firstRowColumns.map((column, index) => slugify(column).replace(/-/g, "_") || `column_${index + 1}`)
    : firstRowColumns.map((_column, index) => `column_${index + 1}`);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const entities = dataRows.flatMap((line) => {
    const columns = parseCsvRow(line);
    const name = sanitizeCsvCell(columns[0]);

    if (!name) {
      return [];
    }

    return [
      toEntity(name, "csv", {
        titleTemplate,
        attributes: buildAttributes(headers, columns),
      }),
    ];
  });

  return dedupeEntities(entities);
}

function discoverFromSeed(seedKeyword: string, patternTemplates: string[], titleTemplate?: string): EntityRecord[] {
  const normalizedSeed = seedKeyword.trim();

  const placeholderEntities = patternTemplates.map((template) => template.replaceAll("{seed}", normalizedSeed));

  return dedupeEntities(
    placeholderEntities.map((value) =>
      toEntity(value, "seed", {
        seedKeyword: normalizedSeed,
        titleTemplate,
      }),
    ),
  );
}

export async function discover(options: DiscoverOptions): Promise<DiscoverResult> {
  if (!options.csv && !options.seed) {
    throw new Error("Provide either a csv path or a seed keyword.");
  }

  if (options.seed && options.seed.trim().length === 0) {
    throw new Error("Seed keyword must not be empty.");
  }

  if (options.csv && !options.csv.endsWith(".csv")) {
    throw new Error("CSV file must have a .csv extension.");
  }

  const entities = options.csv
    ? await discoverFromCsv(options.csv, options.titleTemplate)
    : discoverFromSeed(options.seed as string, resolvePatterns(options.patterns), options.titleTemplate);

  return {
    generatedAt: new Date().toISOString(),
    mode: options.csv ? "csv" : "seed",
    entityCount: entities.length,
    entities,
  };
}