import { readFile } from "node:fs/promises";

import type { DiscoverMode, DiscoverOptions, DiscoverResult, EntityRecord } from "../types";
import { slugify, stableHash } from "./utils";

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

function buildTitle(name: string, source: DiscoverMode, titleTemplate?: string): string {
  const fallbackTemplate =
    source === "seed"
      ? "{name} pages and comparisons"
      : "{name} overview and entity details";

  return (titleTemplate ?? fallbackTemplate).replaceAll("{name}", name);
}

function buildDescription(name: string, source: DiscoverMode, seedKeyword?: string): string {
  if (source === "seed" && seedKeyword) {
    return `Programmatic SEO placeholder content for ${name}, expanded from the seed keyword ${seedKeyword}.`;
  }

  return `Programmatic SEO placeholder content for ${name}.`;
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
    const name = columns[0];

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