import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DiscoverResult, EntityMetadata, EntityRecord } from "../types";

type WarningCategory = "ymyl" | "thin-content" | "duplicate-slug";

type WarningRecord = {
  category: WarningCategory;
  message: string;
};

type GenerationSummary = {
  totalEntitiesProcessed: number;
  pagesSuccessfullyGenerated: number;
  warningsRaised: {
    ymyl: number;
    thinContent: number;
    duplicateSlug: number;
  };
  todosRemaining: string[];
};

const YMYL_TERMS = [
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
];

const TODO_SECTIONS = [
  "Intro paragraph",
  "FAQ section",
  "Comparison section",
];

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function escapeTemplateLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function escapeJsxText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toDisplayJson(value: Record<string, string> | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function countPopulatedMetadataFields(metadata: EntityMetadata): number {
  return [metadata.title, metadata.description, metadata.tags?.length ? metadata.tags.join(",") : undefined, metadata.attributes && Object.keys(metadata.attributes).length > 0 ? "attributes" : undefined]
    .filter(Boolean)
    .length;
}

function matchesYmyl(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return YMYL_TERMS.some((term) => normalizedValue.includes(term));
}

function validateEntities(entities: EntityRecord[]): {
  validEntities: EntityRecord[];
  warnings: WarningRecord[];
} {
  const warnings: WarningRecord[] = [];
  const seenSlugs = new Set<string>();
  const validEntities: EntityRecord[] = [];

  for (const entity of entities) {
    if (!entity.name.trim() || !entity.slug.trim()) {
      warnings.push({
        category: "thin-content",
        message: `Thin content risk for ${entity.name || entity.slug || "unknown entity"}: consider enriching metadata`,
      });
      continue;
    }

    if (seenSlugs.has(entity.slug)) {
      warnings.push({
        category: "duplicate-slug",
        message: `Duplicate slug detected: ${entity.slug} — only first entity will be generated`,
      });
      continue;
    }

    seenSlugs.add(entity.slug);

    const ymylCandidates = [entity.name, entity.seedKeyword ?? "", ...(entity.metadata.tags ?? [])].filter(Boolean);

    if (ymylCandidates.some((value) => matchesYmyl(value))) {
      warnings.push({
        category: "ymyl",
        message: `YMYL topic detected for ${entity.name}: review before publishing`,
      });
    }

    if (countPopulatedMetadataFields(entity.metadata) < 3) {
      warnings.push({
        category: "thin-content",
        message: `Thin content risk for ${entity.name}: consider enriching metadata`,
      });
    }

    validEntities.push(entity);
  }

  return { validEntities, warnings };
}

function renderTags(tags: string[]): string {
  if (tags.length === 0) {
    return "            <p className=\"text-sm text-neutral-500\">No tags available yet.</p>";
  }

  return tags
    .map(
      (tag) =>
        `            <li className=\"rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-700\">${escapeJsxText(tag)}</li>`,
    )
    .join("\n");
}

function renderAttributes(attributes: Record<string, string> | undefined): string {
  const entries = Object.entries(attributes ?? {});

  if (entries.length === 0) {
    return "            <p className=\"text-sm text-neutral-500\">No additional attributes were discovered for this entity.</p>";
  }

  return entries
    .map(
      ([key, value]) => `            <div className=\"rounded-2xl border border-neutral-200 p-4\">\n              <dt className=\"text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500\">${escapeJsxText(key)}</dt>\n              <dd className=\"mt-2 text-sm text-neutral-700\">${escapeJsxText(value)}</dd>\n            </div>`,
    )
    .join("\n");
}

function renderPageContent(entity: EntityRecord, totalEntities: number): string {
  const title = entity.metadata.title ?? entity.name;
  const description = entity.metadata.description ?? `Explore ${entity.name}.`;
  const tags = entity.metadata.tags ?? [];
  const attributes = entity.metadata.attributes;

  return `// SOPHON GENERATED — DO NOT manually edit AI content sections
// All TODO sections must be filled with grounded, sourced content
// Do not invent statistics, prices, comparisons, or factual claims
// Review YMYL warnings before publishing

import type { Metadata } from "next";

const entity = {
  id: "${escapeTemplateLiteral(entity.id)}",
  name: "${escapeTemplateLiteral(entity.name)}",
  slug: "${escapeTemplateLiteral(entity.slug)}",
  source: "${escapeTemplateLiteral(entity.source)}",
  seedKeyword: ${entity.seedKeyword ? `"${escapeTemplateLiteral(entity.seedKeyword)}"` : "undefined"},
  metadata: {
    title: "${escapeTemplateLiteral(title)}",
    description: "${escapeTemplateLiteral(description)}",
    tags: ${JSON.stringify(tags)},
    attributes: ${toDisplayJson(attributes)},
  },
} as const;

export const metadata: Metadata = {
  title: entity.metadata.title,
  description: entity.metadata.description,
  alternates: {
    canonical: "/${escapeTemplateLiteral(entity.slug)}",
  },
};

export default function SophonEntityPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-16">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Sophon generated page</p>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-950">${escapeJsxText(title)}</h1>
        <p className="max-w-3xl text-base leading-7 text-neutral-700">${escapeJsxText(description)}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-8 rounded-3xl border border-neutral-200 p-8">
          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-neutral-950">Entity overview</h2>
            <p className="text-neutral-700">This static route was generated by Sophon from a dataset of ${String(totalEntities)} entities.</p>
          </div>

          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: Intro paragraph</h2>
            <p className="text-neutral-700">Replace this with grounded introductory copy based on verified source material for ${escapeJsxText(entity.name)}.</p>
          </section>

          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: FAQ section</h2>
            <p className="text-neutral-700">Add factual questions and answers sourced from trustworthy references before publishing.</p>
          </section>

          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: Comparison section</h2>
            <p className="text-neutral-700">Add evidence-based comparisons only after validating claims, pricing, and product details.</p>
          </section>
        </article>

        <aside className="space-y-6 rounded-3xl bg-neutral-50 p-8">
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-neutral-950">Entity metadata</h2>
            <dl className="space-y-2 text-sm text-neutral-700">
              <div>
                <dt className="font-medium text-neutral-900">Entity name</dt>
                <dd>${escapeJsxText(entity.name)}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-900">Entity slug</dt>
                <dd>${escapeJsxText(entity.slug)}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-900">Source</dt>
                <dd>${escapeJsxText(entity.source)}</dd>
              </div>
              ${entity.seedKeyword ? `<div>
                <dt className="font-medium text-neutral-900">Seed keyword</dt>
                <dd>${escapeJsxText(entity.seedKeyword)}</dd>
              </div>` : ""}
            </dl>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium text-neutral-950">Tags</h2>
            <ul className="flex flex-wrap gap-2 text-sm text-neutral-700">
${renderTags(tags)}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium text-neutral-950">Attributes</h2>
            <dl className="space-y-3 text-sm text-neutral-700">
${renderAttributes(attributes)}
            </dl>
          </div>
        </aside>
      </section>
    </main>
  );
}
`;
}

function buildPageFilePath(outputRoot: string, slug: string): string {
  return path.join(outputRoot, slug, "page.tsx");
}

async function writeGeneratedFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  console.log(`Generated file -> ${filePath}`);
}

function logWarnings(warnings: WarningRecord[]): void {
  for (const warning of warnings) {
    console.warn(warning.message);
  }
}

function logSummary(summary: GenerationSummary): void {
  console.log(
    JSON.stringify(
      {
        totalEntitiesProcessed: summary.totalEntitiesProcessed,
        pagesSuccessfullyGenerated: summary.pagesSuccessfullyGenerated,
        warningsRaised: summary.warningsRaised,
        todosRemaining: summary.todosRemaining,
      },
      null,
      2,
    ),
  );
}

async function loadEntities(filePath: string): Promise<DiscoverResult> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as DiscoverResult;
}

async function main(): Promise<void> {
  const entitiesPath = getArg("--entities") ?? path.join("data", "entities.json");
  const outputRoot = getArg("--output") ?? "app";
  const payload = await loadEntities(entitiesPath);
  const { validEntities, warnings } = validateEntities(payload.entities);

  logWarnings(warnings);

  let pagesSuccessfullyGenerated = 0;

  for (const entity of validEntities) {
    const pageFilePath = buildPageFilePath(outputRoot, entity.slug);
    const pageContent = renderPageContent(entity, validEntities.length);

    await writeGeneratedFile(pageFilePath, pageContent);
    pagesSuccessfullyGenerated += 1;
  }

  const summary: GenerationSummary = {
    totalEntitiesProcessed: payload.entities.length,
    pagesSuccessfullyGenerated,
    warningsRaised: {
      ymyl: warnings.filter((warning) => warning.category === "ymyl").length,
      thinContent: warnings.filter((warning) => warning.category === "thin-content").length,
      duplicateSlug: warnings.filter((warning) => warning.category === "duplicate-slug").length,
    },
    todosRemaining: TODO_SECTIONS,
  };

  logSummary(summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});