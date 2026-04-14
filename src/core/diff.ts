import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { astro } from "../adapters/astro";
import { nextjs } from "../adapters/nextjs";
import { nuxt } from "../adapters/nuxt";
import { remix } from "../adapters/remix";
import { sveltekit } from "../adapters/sveltekit";
import { buildHydrationMap, loadEnrichedContent } from "./generate";
import { classifyIntent } from "./intent";
import { log } from "./utils";
import { getSections, renderSections } from "./sections";
import type { EntityRecord, Framework, GenerateOptions } from "../types";

type DiffChange = {
  type: "new" | "updated" | "removed" | "unchanged";
  path: string;
  slug: string;
};

type DiffResult = {
  newPages: number;
  updatedPages: number;
  unchangedPages: number;
  removedPages: number;
  changes: DiffChange[];
};

type DiffOptions = {
  entities: EntityRecord[];
  framework: Framework;
  output?: string;
  site?: string;
};

type AdapterGenerator = (options: GenerateOptions) => string;

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

function isManagedBySophon(content: string): boolean {
  return content.includes("SOPHON GENERATED") || content.includes("Sophon generated");
}

export async function diffGenerate(options: DiffOptions): Promise<DiffResult> {
  const outputRoot = options.output ?? defaultOutputRoot(options.framework);
  const changes: DiffChange[] = [];
  const entitySlugs = new Set(options.entities.map((e) => e.slug));

  for (const entity of options.entities) {
    const pagePath = buildMainPagePath(options.framework, outputRoot, entity.slug);

    let existingContent: string | null = null;
    try {
      existingContent = await readFile(pagePath, "utf8");
    } catch (error) {
      log("debug", "diff", `Page file not found: ${pagePath}`, { slug: entity.slug, error: (error as Error).message });
    }

    if (!existingContent) {
      changes.push({ type: "new", path: pagePath, slug: entity.slug });
      continue;
    }

    if (!isManagedBySophon(existingContent)) {
      changes.push({ type: "unchanged", path: pagePath, slug: entity.slug });
      continue;
    }

    // Generate what would be produced
    const enriched = await loadEnrichedContent(entity.slug);
    const template = ADAPTERS[options.framework]({
      entities: [entity],
      framework: options.framework,
      site: options.site,
    });

    // Simple content comparison (strip whitespace-only differences)
    const normalizeForCompare = (s: string) => s.replace(/\s+/g, " ").trim();
    if (normalizeForCompare(existingContent) !== normalizeForCompare(template)) {
      changes.push({ type: "updated", path: pagePath, slug: entity.slug });
    } else {
      changes.push({ type: "unchanged", path: pagePath, slug: entity.slug });
    }
  }

  // Check for removed pages (Sophon-managed files whose entity no longer exists)
  try {
    const existingFiles = await scanExistingPages(outputRoot, options.framework);
    for (const { slug, filePath } of existingFiles) {
      if (!entitySlugs.has(slug)) {
        try {
          const content = await readFile(filePath, "utf8");
          if (isManagedBySophon(content)) {
            changes.push({ type: "removed", path: filePath, slug });
          }
        } catch (error) {
          log("debug", "diff", `Could not read file for removed check: ${filePath}`, { error: (error as Error).message });
        }
      }
    }
  } catch (error) {
    log("debug", "diff", `Output directory not found: ${outputRoot}`, { error: (error as Error).message });
  }

  return {
    newPages: changes.filter((c) => c.type === "new").length,
    updatedPages: changes.filter((c) => c.type === "updated").length,
    unchangedPages: changes.filter((c) => c.type === "unchanged").length,
    removedPages: changes.filter((c) => c.type === "removed").length,
    changes,
  };
}

async function scanExistingPages(outputRoot: string, framework: Framework): Promise<Array<{ slug: string; filePath: string }>> {
  const results: Array<{ slug: string; filePath: string }> = [];

  try {
    const entries = await readdir(outputRoot, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(outputRoot, entry.name);

      if (entry.isDirectory()) {
        // Next.js and SvelteKit use directories
        if (framework === "nextjs") {
          results.push({ slug: entry.name, filePath: path.join(fullPath, "page.tsx") });
        } else if (framework === "sveltekit") {
          results.push({ slug: entry.name, filePath: path.join(fullPath, "+page.svelte") });
        }
      } else {
        // Astro, Nuxt, Remix use flat files
        const ext = path.extname(entry.name);
        const slug = path.basename(entry.name, ext);
        results.push({ slug, filePath: fullPath });
      }
    }
  } catch (error) {
    log("debug", "diff", `Output directory does not exist: ${outputRoot}`, { error: (error as Error).message });
  }

  return results;
}
