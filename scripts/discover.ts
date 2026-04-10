import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DiscoverMode, DiscoverResult, EntityRecord } from "../types";

const DEFAULT_PATTERNS = [
  "{seed} for startups",
  "{seed} for small business",
  "{seed} for enterprises",
  "{seed} pricing",
  "{seed} alternatives",
  "best {seed}",
  "{seed} comparison",
];

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function getArgs(flag: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag) {
      const value = process.argv[index + 1];

      if (value) {
        values.push(value);
      }
    }
  }

  return values;
}

function getListArg(flag: string): string[] {
  const values = getArgs(flag);

  return values.flatMap((value) =>
    value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function resolvePatterns(primary: string[], legacy: string[]): string[] {
  if (primary.length > 0) {
    return primary;
  }

  if (legacy.length > 0) {
    return legacy;
  }

  return DEFAULT_PATTERNS;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stableHash(value: string): string {
  // This 32-bit hash is deterministic and compact for scaffolded IDs, but it is not collision-proof.
  // If Sophon later needs globally unique IDs across very large datasets, swap this for a stronger hash.
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
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
  const slug = slugify(cleanName);

  return {
    id: buildEntityId(cleanName),
    name: cleanName,
    slug,
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
  return line
    .split(",")
    .map((column: string) => column.trim())
    .filter(Boolean);
}

function isHeaderRow(columns: string[]): boolean {
  return columns.some((column: string) => /name|entity|keyword/i.test(column));
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
    .map((line: string) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const firstRowColumns = parseCsvRow(rows[0]);
  const hasHeader = isHeaderRow(firstRowColumns);
  const headers = hasHeader
    ? firstRowColumns.map((column: string, index: number) => slugify(column).replace(/-/g, "_") || `column_${index + 1}`)
    : firstRowColumns.map((_column: string, index: number) => `column_${index + 1}`);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const entities = dataRows.flatMap((line: string) => {
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

function discoverFromSeed(
  seedKeyword: string,
  patternTemplates: string[],
  titleTemplate?: string,
): EntityRecord[] {
  const normalizedSeed = seedKeyword.trim();

  // TODO: Replace template-based expansion with provider-backed discovery that expands a seed keyword
  // into ranked entities, enriches them with intent and source data, and normalizes overlaps before output.
  const placeholderEntities = patternTemplates.map((template) =>
    template.replaceAll("{seed}", normalizedSeed),
  );

  return dedupeEntities(
    placeholderEntities.map((value) =>
      toEntity(value, "seed", {
        seedKeyword: normalizedSeed,
        titleTemplate,
      }),
    ),
  );
}

async function main(): Promise<void> {
  const csvPath = getArg("--csv");
  const seedKeyword = getArg("--seed");
  const outputPath = getArg("--output") ?? path.join("data", "entities.json");
  const titleTemplate = getArg("--title-template");
  const patternTemplates = getListArg("--pattern");
  const legacyPatternTemplates = getListArg("--patterns");
  const resolvedPatternTemplates = resolvePatterns(patternTemplates, legacyPatternTemplates);

  if (!csvPath && !seedKeyword) {
    throw new Error("Provide either --csv <path> or --seed <keyword>.");
  }

  const entities = csvPath
    ? await discoverFromCsv(csvPath, titleTemplate)
    : discoverFromSeed(seedKeyword as string, resolvedPatternTemplates, titleTemplate);

  const result: DiscoverResult = {
    generatedAt: new Date().toISOString(),
    mode: csvPath ? "csv" : "seed",
    entityCount: entities.length,
    entities,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Discovered ${result.entityCount} entities -> ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});