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
import { log } from "./utils";
import type { EnrichedContent, EntityRecord, Framework, GenerateOptions, GenerateSummary } from "../types";

// Default site URL when none is provided
const DEFAULT_SITE_URL = "https://example.com";

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Template-based content fallback ────────────────────────
// When no enriched content is available, generate structured content
// from entity metadata instead of empty TODO stubs.

function buildFallbackContent(entity: EntityRecord, framework: Framework): string {
  const useTailwind = framework === "nextjs";
  const indentMap: Record<Framework, { indent: number; gap: string }> = {
    nextjs: { indent: 10, gap: "\n\n" },
    sveltekit: { indent: 2, gap: "\n\n" },
    remix: { indent: 6, gap: "\n" },
    astro: { indent: 6, gap: "\n" },
    nuxt: { indent: 4, gap: "\n" },
  };

  const { indent, gap } = indentMap[framework];
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);
  const parts: string[] = [];

  // Build intro from description
  const desc = entity.metadata.description ?? `Learn more about ${entity.name}.`;
  parts.push(
    useTailwind
      ? `${pad}<section className="space-y-3">\n${inner}<p className="text-base leading-7 text-neutral-700">${escapeHtml(desc)}</p>\n${pad}</section>`
      : `${pad}<section>\n${inner}<p>${escapeHtml(desc)}</p>\n${pad}</section>`,
  );

  // Build attributes section if available
  const attrs = entity.metadata.attributes ?? {};
  const attrKeys = Object.keys(attrs);
  if (attrKeys.length > 0) {
    const rows = attrKeys
      .map((key) =>
        useTailwind
          ? `${inner}  <tr>\n${inner}    <td className="pr-4 font-medium text-neutral-950">${escapeHtml(key)}</td>\n${inner}    <td className="text-neutral-700">${escapeHtml(attrs[key])}</td>\n${inner}  </tr>`
          : `${inner}  <tr>\n${inner}    <td>${escapeHtml(key)}</td>\n${inner}    <td>${escapeHtml(attrs[key])}</td>\n${inner}  </tr>`,
      )
      .join("\n");

    parts.push(
      useTailwind
        ? `${pad}<section className="space-y-3 rounded-3xl bg-amber-50 p-6">\n${inner}<h2 className="text-xl font-medium text-neutral-950">Key Details</h2>\n${inner}<table className="w-full">\n${inner}  <tbody>\n${rows}\n${inner}  </tbody>\n${inner}</table>\n${pad}</section>`
        : `${pad}<section>\n${inner}<h2>Key Details</h2>\n${inner}<table>\n${inner}  <tbody>\n${rows}\n${inner}  </tbody>\n${inner}</table>\n${pad}</section>`,
    );
  }

  // Build tags section if available
  const tags = entity.metadata.tags ?? [];
  if (tags.length > 0) {
    const tagList = tags.map((t) => `${inner}  <li>${escapeHtml(t)}</li>`).join("\n");
    parts.push(
      useTailwind
        ? `${pad}<section className="space-y-3">\n${inner}<h2 className="text-xl font-medium text-neutral-950">Related Topics</h2>\n${inner}<ul className="list-disc pl-6 text-neutral-700">\n${tagList}\n${inner}</ul>\n${pad}</section>`
        : `${pad}<section>\n${inner}<h2>Related Topics</h2>\n${inner}<ul>\n${tagList}\n${inner}</ul>\n${pad}</section>`,
    );
  }

  return parts.join(gap);
}

const YMYL_DISCLAIMER_TEXT = "This content is for informational purposes only and does not constitute professional advice. Consult a qualified professional before making any decisions based on this information.";

export function renderYmylDisclaimer(framework: Framework, entity: EntityRecord): string {
  if (!isYmylEntity(entity)) return "";

  const indentMap: Record<Framework, number> = {
    nextjs: 6,
    sveltekit: 0,
    remix: 6,
    astro: 6,
    nuxt: 4,
  };

  const indent = indentMap[framework];
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);
  const useTailwind = framework === "nextjs";

  if (useTailwind) {
    return [
      `${pad}<aside role="note" aria-label="Disclaimer" className="rounded-xl border border-amber-300 bg-amber-50 p-4">`,
      `${inner}<p className="text-sm text-amber-900">`,
      `${inner}  <strong>Disclaimer:</strong> ${YMYL_DISCLAIMER_TEXT}`,
      `${inner}</p>`,
      `${pad}</aside>`,
    ].join("\n");
  }

  return [
    `${pad}<aside role="note" aria-label="Disclaimer">`,
    `${inner}<p>`,
    `${inner}  <strong>Disclaimer:</strong> ${YMYL_DISCLAIMER_TEXT}`,
    `${inner}</p>`,
    `${pad}</aside>`,
  ].join("\n");
}

export async function loadEnrichedContent(slug: string, enrichDir?: string): Promise<EnrichedContent | null> {
  const dir = enrichDir ?? path.join("data", "enriched");
  try {
    const raw = await readFile(path.join(dir, slug, "content.json"), "utf8");
    return JSON.parse(raw) as EnrichedContent;
  } catch (error) {
    log("debug", "generate", `No enriched content for ${slug}`, { dir, error: (error as Error).message });
    return null;
  }
}

function renderEnrichedContent(framework: Framework, content: EnrichedContent["content"]): string {
  const useTailwind = framework === "nextjs";
  const indentMap: Record<Framework, { indent: number; gap: string }> = {
    nextjs: { indent: 10, gap: "\n\n" },
    sveltekit: { indent: 2, gap: "\n\n" },
    remix: { indent: 6, gap: "\n" },
    astro: { indent: 6, gap: "\n" },
    nuxt: { indent: 4, gap: "\n" },
  };

  const { indent, gap } = indentMap[framework];
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);
  const parts: string[] = [];

  if (content.intro) {
    parts.push(
      useTailwind
        ? `${pad}<section className="space-y-3">\n${inner}<p className="text-base leading-7 text-neutral-700">${escapeHtml(content.intro)}</p>\n${pad}</section>`
        : `${pad}<section>\n${inner}<p>${escapeHtml(content.intro)}</p>\n${pad}</section>`,
    );
  }

  for (const section of content.sections) {
    parts.push(
      useTailwind
        ? `${pad}<section className="space-y-3 rounded-3xl bg-amber-50 p-6">\n${inner}<h2 className="text-xl font-medium text-neutral-950">${escapeHtml(section.heading)}</h2>\n${inner}<p className="text-neutral-700">${escapeHtml(section.body)}</p>\n${pad}</section>`
        : `${pad}<section>\n${inner}<h2>${escapeHtml(section.heading)}</h2>\n${inner}<p>${escapeHtml(section.body)}</p>\n${pad}</section>`,
    );
  }

  if (content.faqs && content.faqs.length > 0) {
    const faqItems = content.faqs
      .map((faq) =>
        useTailwind
          ? `${inner}  <dt className="font-medium text-neutral-950">${escapeHtml(faq.question)}</dt>\n${inner}  <dd className="text-neutral-700">${escapeHtml(faq.answer)}</dd>`
          : `${inner}  <dt>${escapeHtml(faq.question)}</dt>\n${inner}  <dd>${escapeHtml(faq.answer)}</dd>`,
      )
      .join("\n");

    parts.push(
      useTailwind
        ? `${pad}<section className="space-y-3">\n${inner}<h2 className="text-xl font-medium text-neutral-950">Frequently Asked Questions</h2>\n${inner}<dl className="space-y-4">\n${faqItems}\n${inner}</dl>\n${pad}</section>`
        : `${pad}<section>\n${inner}<h2>Frequently Asked Questions</h2>\n${inner}<dl>\n${faqItems}\n${inner}</dl>\n${pad}</section>`,
    );
  }

  return parts.join(gap);
}

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

export function buildHydrationMap(entity: EntityRecord, siteUrl?: string, enriched?: EnrichedContent | null): Record<string, string> {
  const resolvedSiteUrl = (siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, "");
  const title = enriched?.seo?.title ?? entity.metadata.title ?? entity.name;
  const description = enriched?.seo?.metaDescription ?? entity.metadata.description ?? `Explore ${entity.name}.`;
  const schemaJsonLd = {
    "@context": "https://schema.org",
    "@type": enriched?.schema?.type ?? "WebPage",
    name: title,
    description,
    url: `${resolvedSiteUrl}/${entity.slug}`,
  };

  return {
    "__ENTITY_NAME__": safeJsonStringify(entity.name),
    "__ENTITY_SLUG__": safeJsonStringify(entity.slug),
    "__ENTITY_TITLE__": safeJsonStringify(title),
    "__ENTITY_DESCRIPTION__": safeJsonStringify(description),
    "__ENTITY_TAGS__": safeJsonStringify(entity.metadata.tags ?? []),
    "__ENTITY_ATTRIBUTES__": safeJsonStringify(entity.metadata.attributes ?? {}),
    "__ENTITY_OG_IMAGE__": safeJsonStringify(entity.metadata.ogImage ?? ""),
    "__SITE_URL__": safeJsonStringify(resolvedSiteUrl),
    "__ENTITY_SCHEMA_JSONLD__": safeJsonStringify(schemaJsonLd),
  };
}

function hydrateTemplate(template: string, entity: EntityRecord, framework: Framework, siteUrl?: string, enriched?: EnrichedContent | null): string {
  const intent = classifyIntent(entity.name).intent;

  let sectionsHtml: string;
  if (enriched?.content) {
    sectionsHtml = renderEnrichedContent(framework, enriched.content);
  } else {
    // Use template-based fallback from metadata, with TODO sections appended
    const fallback = buildFallbackContent(entity, framework);
    const todoSections = renderSections(framework, getSections(intent));
    sectionsHtml = fallback + "\n\n" + todoSections;
  }

  const replacements: Record<string, string> = {
    ...buildHydrationMap(entity, siteUrl, enriched),
    "__ENTITY_SECTIONS__": sectionsHtml,
    "__ENTITY_YMYL_DISCLAIMER__": renderYmylDisclaimer(framework, entity),
  };

  return template.replace(/__(?:ENTITY|SITE)_[A-Z_]+__/g, (match) => {
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

function buildAdditionalFiles(framework: Framework, outputRoot: string, entity: EntityRecord, siteUrl?: string, enriched?: EnrichedContent | null): Array<{ filePath: string; content: string }> {
  if (framework !== "sveltekit") {
    return [];
  }

  return [
    {
      filePath: path.join(outputRoot, entity.slug, "+page.ts"),
      content: hydrateTemplate(buildSvelteKitPageModule(), entity, framework, siteUrl, enriched),
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
    } catch (error) {
      log("debug", "generate", `File does not exist yet: ${filePath}`, { error: (error as Error).message });
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
  let todosRemaining = 0;

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

    // Load enriched content if available
    const enriched = await loadEnrichedContent(entity.slug);

    const template = customTemplate ?? buildFrameworkTemplate(options, entity);
    const pageContent = customTemplate
      ? prependCommentBlock(options.framework, hydrateTemplate(template, entity, options.framework, options.site, enriched))
      : hydrateTemplate(template, entity, options.framework, options.site, enriched);
    const pagePath = buildMainPagePath(options.framework, outputRoot, entity.slug);

    const pageWritten = await writeGeneratedFile(pagePath, pageContent, {
      force: options.force,
    });

    if (!pageWritten) {
      warnings.push(`Page skipped because existing implementation was detected: ${pagePath}`);
      continue;
    }

    for (const file of buildAdditionalFiles(options.framework, outputRoot, entity, options.site, enriched)) {
      await writeGeneratedFile(file.filePath, prependCommentBlock(options.framework, file.content), {
        force: options.force,
      });
    }

    if (!enriched) {
      todosRemaining += TODO_SECTIONS_PER_PAGE;
    }
    generated += 1;
  }

  const summary: GenerateSummary = {
    total: options.entities.length,
    generated,
    warnings,
    todos: todosRemaining,
  };

  console.log(`Total entities processed: ${summary.total}`);
  console.log(`Pages generated: ${summary.generated}`);
  console.log(`Warnings: ${summary.warnings.length}`);
  console.log(`TODOs remaining: ${summary.todos}`);

  return summary;
}