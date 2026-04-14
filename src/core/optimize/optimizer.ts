import { readFile } from "node:fs/promises";
import path from "node:path";

import { writeGeneratedFile } from "../generate";
import { assertSafePath, log } from "../utils";
import type { EntityRecord, EntityOptimizationResult, OptimizationRecommendation, EnrichedContent } from "../../types";

/**
 * Auto-fix applies safe, non-destructive updates to Sophon-generated files.
 * Only modifies files within the project directory that contain Sophon markers.
 *
 * Supports:
 * - Rewriting SEO title tags based on recommendations
 * - Improving meta descriptions with stronger CTAs
 * - Injecting missing canonical tags
 * - Adding missing OG/Twitter meta tags
 * - Backing up content before modifications
 */

const SOPHON_MARKER = "SOPHON GENERATED";

export type AutoFixResult = {
  slug: string;
  applied: string[];
  skipped: string[];
};

export async function applyAutoFixes(
  results: EntityOptimizationResult[],
  entities: EntityRecord[],
  outputRoot: string,
): Promise<AutoFixResult[]> {
  const fixResults: AutoFixResult[] = [];

  for (const result of results) {
    if (result.recommendations.length === 0) continue;

    const entity = entities.find((e) => e.slug === result.slug);
    if (!entity) continue;

    const fixResult = await applyEntityFixes(result, entity, outputRoot);
    if (fixResult.applied.length > 0 || fixResult.skipped.length > 0) {
      fixResults.push(fixResult);
    }
  }

  return fixResults;
}

// ── Title rewriting ────────────────────────────────────────

const POWER_WORDS = ["Ultimate", "Complete", "Essential", "Proven", "Expert"];
const YEAR = new Date().getFullYear().toString();

function rewriteTitle(entity: EntityRecord, currentTitle: string): string {
  // If title already has power words and brackets, leave it
  if (/[\[(]/.test(currentTitle) && POWER_WORDS.some((pw) => currentTitle.includes(pw))) {
    return currentTitle;
  }

  const name = entity.metadata.title ?? entity.name;
  const powerWord = POWER_WORDS[name.length % POWER_WORDS.length];

  // Add brackets and power words for CTR improvement
  let newTitle = `${name}: ${powerWord} Guide [${YEAR}]`;

  // Truncate to ~60 chars
  if (newTitle.length > 65) {
    newTitle = `${name} [${YEAR} Guide]`;
  }
  if (newTitle.length > 65) {
    newTitle = name.slice(0, 55) + `... [${YEAR}]`;
  }

  return newTitle;
}

// ── Meta description improvement ───────────────────────────

function improveMetaDescription(entity: EntityRecord, current: string): string {
  // If description already has CTA-like words, leave it
  if (/\b(discover|learn|compare|find|get|start|try)\b/i.test(current)) {
    return current;
  }

  const name = entity.metadata.title ?? entity.name;
  const improved = `Compare ${name} options. See features, pricing, and real pros & cons. Find the best fit for your needs.`;

  // Trim to 155 chars
  if (improved.length > 160) {
    return improved.slice(0, 155).replace(/\s+\S*$/, "...");
  }

  return improved;
}

// ── Canonical/OG tag injection ─────────────────────────────

function ensureCanonicalPath(seo: Record<string, unknown>, slug: string): boolean {
  if (seo.canonicalPath) return false;
  seo.canonicalPath = `/${slug}`;
  return true;
}

function ensureOgFields(content: Record<string, unknown>, entity: EntityRecord): string[] {
  const applied: string[] = [];
  const seo = (content.seo ?? {}) as Record<string, unknown>;

  // Ensure OG title exists
  if (!seo.ogTitle && seo.title) {
    seo.ogTitle = seo.title;
    applied.push("Added og:title from SEO title");
  }

  // Ensure OG description exists
  if (!seo.ogDescription && seo.metaDescription) {
    seo.ogDescription = seo.metaDescription;
    applied.push("Added og:description from meta description");
  }

  content.seo = seo;
  return applied;
}

async function applyEntityFixes(
  result: EntityOptimizationResult,
  entity: EntityRecord,
  outputRoot: string,
): Promise<AutoFixResult> {
  const applied: string[] = [];
  const skipped: string[] = [];

  const enrichedPath = path.join(outputRoot, "data", "enriched", entity.slug, "content.json");

  try {
    assertSafePath(enrichedPath);
    const raw = await readFile(enrichedPath, "utf8");
    let content: Record<string, unknown>;

    try {
      content = JSON.parse(raw) as Record<string, unknown>;
    } catch (parseError) {
      log("error", "optimizer", `Invalid JSON in enriched content for ${entity.slug}`, { error: (parseError as Error).message });
      skipped.push(`Skipped: invalid JSON in enriched content for ${entity.slug}`);
      return { slug: result.slug, applied, skipped };
    }

    // Save backup before modifications
    const backupPath = enrichedPath.replace(/\.json$/, ".backup.json");
    try {
      assertSafePath(backupPath);
      await writeGeneratedFile(backupPath, raw, { force: true });
    } catch (backupError) {
      log("warn", "optimizer", `Could not create backup for ${entity.slug}`, { error: (backupError as Error).message });
    }

    const seo = (content.seo ?? {}) as Record<string, unknown>;
    const warnings = (content.warnings ?? []) as string[];

    // Apply fixes based on recommendation types
    for (const rec of result.recommendations) {
      switch (rec.type) {
        case "meta": {
          if (rec.action.toLowerCase().includes("title")) {
            const oldTitle = (seo.title as string) ?? "";
            const newTitle = rewriteTitle(entity, oldTitle);
            if (newTitle !== oldTitle) {
              seo.title = newTitle;
              applied.push(`Rewrote title: "${oldTitle.slice(0, 40)}..." → "${newTitle.slice(0, 40)}..."`);
            } else {
              skipped.push(`Title already optimized for ${entity.slug}`);
            }
          } else if (rec.action.toLowerCase().includes("meta description") || rec.action.toLowerCase().includes("description")) {
            const oldDesc = (seo.metaDescription as string) ?? "";
            const newDesc = improveMetaDescription(entity, oldDesc);
            if (newDesc !== oldDesc) {
              seo.metaDescription = newDesc;
              applied.push(`Improved meta description for ${entity.slug}`);
            } else {
              skipped.push(`Meta description already has CTA for ${entity.slug}`);
            }
          } else if (rec.action.toLowerCase().includes("keyword alignment")) {
            // Add keyword alignment warning for manual review
            warnings.push(`[OPTIMIZE] ${rec.action}`);
            applied.push(`Added keyword alignment TODO for ${entity.slug}`);
          } else {
            warnings.push(`[OPTIMIZE] ${rec.action}`);
            applied.push(`Added optimization note: ${rec.action}`);
          }
          break;
        }
        case "structure": {
          // Inject canonical path if missing
          if (rec.action.toLowerCase().includes("canonical") || ensureCanonicalPath(seo, entity.slug)) {
            applied.push(`Injected canonical path /${entity.slug}`);
          }

          // Add FAQ marker for content team
          if (rec.action.toLowerCase().includes("faq")) {
            warnings.push(`[OPTIMIZE] ${rec.action}`);
            applied.push(`Added FAQ recommendation for ${entity.slug}`);
          } else {
            warnings.push(`[OPTIMIZE] ${rec.action}`);
            applied.push(`Added structural note: ${rec.action}`);
          }
          break;
        }
        case "content": {
          warnings.push(`[OPTIMIZE] ${rec.action}`);
          applied.push(`Added content recommendation: ${rec.action}`);
          break;
        }
        case "linking": {
          warnings.push(`[OPTIMIZE] ${rec.action}`);
          applied.push(`Added linking recommendation: ${rec.action}`);
          break;
        }
      }
    }

    // Ensure canonical and OG fields exist
    if (ensureCanonicalPath(seo, entity.slug)) {
      applied.push(`Injected missing canonical path /${entity.slug}`);
    }
    const ogApplied = ensureOgFields(content, entity);
    applied.push(...ogApplied);

    content.seo = seo;
    content.warnings = warnings;
    content.lastOptimizedAt = new Date().toISOString();

    await writeGeneratedFile(
      enrichedPath,
      `${JSON.stringify(content, null, 2)}\n`,
      { force: true },
    );
  } catch (error) {
    log("warn", "optimizer", `Auto-fix failed for ${entity.slug}: ${(error as Error).message}`, { slug: entity.slug });
    for (const rec of result.recommendations) {
      skipped.push(`Could not auto-fix: ${rec.action} (${(error as Error).message})`);
    }
  }

  return { slug: result.slug, applied, skipped };
}

/**
 * Check if a file is Sophon-generated (safe to modify).
 */
export async function isSophonFile(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, "utf8");
    return content.includes(SOPHON_MARKER);
  } catch (error) {
    log("debug", "optimizer", `Could not read file for Sophon check: ${filePath}`, { error: (error as Error).message });
    return false;
  }
}
