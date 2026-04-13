import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { astro } from "../adapters/astro";
import { nextjs } from "../adapters/nextjs";
import { nuxt } from "../adapters/nuxt";
import { remix } from "../adapters/remix";
import { buildSvelteKitPageModule } from "../adapters/sveltekit-page";
import { sveltekit } from "../adapters/sveltekit";
import { classifyIntent } from "./intent";
import { getSections, renderSections } from "./sections";
import { safeJsonStringify } from "./utils";
import type { EntityRecord, Framework, GenerateOptions, GenerateSummary } from "../types";

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
  "mental health",
];

const TODO_SECTIONS_PER_PAGE = 4;

type AdapterGenerator = (options: GenerateOptions) => string;

const COMMENT_BLOCKS: Record<Framework, string> = {
  nextjs: [
    "// SOPHON GENERATED",
    "// Do not invent statistics, prices, comparisons, or factual claims",
    "// All TODO sections must be filled with grounded sourced content",
    "// Review YMYL warnings before publishing",
    "",
  ].join("\n"),
  remix: [
    "// SOPHON GENERATED",
    "// Do not invent statistics, prices, comparisons, or factual claims",
    "// All TODO sections must be filled with grounded sourced content",
    "// Review YMYL warnings before publishing",
    "",
  ].join("\n"),
  astro: [
    "<!-- SOPHON GENERATED -->",
    "<!-- Do not invent statistics, prices, comparisons, or factual claims -->",
    "<!-- All TODO sections must be filled with grounded sourced content -->",
    "<!-- Review YMYL warnings before publishing -->",
    "",
  ].join("\n"),
  nuxt: [
    "<!-- SOPHON GENERATED -->",
    "<!-- Do not invent statistics, prices, comparisons, or factual claims -->",
    "<!-- All TODO sections must be filled with grounded sourced content -->",
    "<!-- Review YMYL warnings before publishing -->",
    "",
  ].join("\n"),
  sveltekit: [
    "<!-- SOPHON GENERATED -->",
    "<!-- Do not invent statistics, prices, comparisons, or factual claims -->",
    "<!-- All TODO sections must be filled with grounded sourced content -->",
    "<!-- Review YMYL warnings before publishing -->",
    "",
  ].join("\n"),
};

const ADAPTERS: Record<Framework, AdapterGenerator> = {
  nextjs,
  astro,
  nuxt,
  sveltekit,
  remix,
};

function defaultOutputRoot(framework: Framework): string {
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

function countPopulatedMetadataFields(entity: EntityRecord): number {
  return [
    entity.metadata.title,
    entity.metadata.description,
    entity.metadata.tags && entity.metadata.tags.length > 0 ? "tags" : undefined,
    entity.metadata.attributes && Object.keys(entity.metadata.attributes).length > 0 ? "attributes" : undefined,
  ]
    .filter(Boolean)
    .length;
}

export function isYmylEntity(entity: EntityRecord): boolean {
  const haystack = [entity.name, entity.seedKeyword ?? "", ...(entity.metadata.tags ?? [])].join(" ").toLowerCase();
  return YMYL_TERMS.some((term) => haystack.includes(term));
}

export function buildHydrationMap(entity: EntityRecord): Record<string, string> {
  return {
    "__ENTITY_NAME__": safeJsonStringify(entity.name),
    "__ENTITY_SLUG__": safeJsonStringify(entity.slug),
    "__ENTITY_TITLE__": safeJsonStringify(entity.metadata.title ?? entity.name),
    "__ENTITY_DESCRIPTION__": safeJsonStringify(entity.metadata.description ?? `Explore ${entity.name}.`),
    "__ENTITY_TAGS__": safeJsonStringify(entity.metadata.tags ?? []),
    "__ENTITY_ATTRIBUTES__": safeJsonStringify(entity.metadata.attributes ?? {}),
  };
}

function hydrateTemplate(template: string, entity: EntityRecord, framework: Framework): string {
  const intent = classifyIntent(entity.name).intent;
  const sections = getSections(intent);

  const replacements: Record<string, string> = {
    ...buildHydrationMap(entity),
    "__ENTITY_SECTIONS__": renderSections(framework, sections),
    "__ENTITY_INTENT__": intent,
  };

  return template.replace(/__ENTITY_[A-Z_]+__/g, (match) => {
    return Object.hasOwn(replacements, match) ? replacements[match] : match;
  });
}

function buildFrameworkTemplate(options: GenerateOptions, entity: EntityRecord): string {
  return ADAPTERS[options.framework]({
    ...options,
    entities: [entity],
  });
}

function buildMainPagePath(framework: Framework, outputRoot: string, slug: string): string {
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

function buildAdditionalFiles(framework: Framework, outputRoot: string, entity: EntityRecord): Array<{ filePath: string; content: string }> {
  if (framework !== "sveltekit") {
    return [];
  }

  return [
    {
      filePath: path.join(outputRoot, entity.slug, "+page.ts"),
      content: hydrateTemplate(buildSvelteKitPageModule(), entity, framework),
    },
  ];
}

function prependCommentBlock(framework: Framework, content: string): string {
  return `${COMMENT_BLOCKS[framework]}${content}`;
}

type WriteGeneratedFileOptions = {
  force?: boolean;
};

function isManagedBySophon(content: string): boolean {
  return content.includes("SOPHON GENERATED") || content.includes("Sophon generated");
}

export async function writeGeneratedFile(
  filePath: string,
  content: string,
  options: WriteGeneratedFileOptions = {},
): Promise<boolean> {
  if (!options.force) {
    try {
      const existing = await readFile(filePath, "utf8");

      if (!isManagedBySophon(existing)) {
        console.warn(
          `Skipping existing file already in place: ${filePath} (use --force to overwrite).`,
        );
        return false;
      }
    } catch {
      // File does not exist yet.
    }
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  console.log(`Generated file -> ${filePath}`);
  return true;
}

export async function generate(options: GenerateOptions): Promise<GenerateSummary> {
  const outputRoot = options.output ?? defaultOutputRoot(options.framework);
  const customTemplate = options.template ? await readFile(options.template, "utf8") : undefined;
  const seenSlugs = new Set<string>();
  const warnings: string[] = [];
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
    const pageContent = customTemplate
      ? prependCommentBlock(options.framework, hydrateTemplate(template, entity, options.framework))
      : hydrateTemplate(template, entity, options.framework);
    const pagePath = buildMainPagePath(options.framework, outputRoot, entity.slug);

    const pageWritten = await writeGeneratedFile(pagePath, pageContent, {
      force: options.force,
    });

    if (!pageWritten) {
      warnings.push(`Page skipped because existing implementation was detected: ${pagePath}`);
      continue;
    }

    for (const file of buildAdditionalFiles(options.framework, outputRoot, entity)) {
      await writeGeneratedFile(file.filePath, prependCommentBlock(options.framework, file.content), {
        force: options.force,
      });
    }

    generated += 1;
  }

  const summary: GenerateSummary = {
    total: options.entities.length,
    generated,
    warnings,
    todos: generated * TODO_SECTIONS_PER_PAGE,
  };

  console.log(`Total entities processed: ${summary.total}`);
  console.log(`Pages generated: ${summary.generated}`);
  console.log(`Warnings: ${summary.warnings.length}`);
  console.log(`TODOs remaining: ${summary.todos}`);

  return summary;
}