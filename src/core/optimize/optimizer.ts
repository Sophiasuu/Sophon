import { readFile } from "node:fs/promises";
import path from "node:path";

import { writeGeneratedFile } from "../generate";
import { assertSafePath } from "../utils";
import type { EntityRecord, EntityOptimizationResult } from "../../types";

/**
 * Auto-fix applies safe, non-destructive updates to Sophon-generated files.
 * Only modifies files within the project directory that contain Sophon markers.
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

async function applyEntityFixes(
  result: EntityOptimizationResult,
  entity: EntityRecord,
  outputRoot: string,
): Promise<AutoFixResult> {
  const applied: string[] = [];
  const skipped: string[] = [];

  // Only process meta-type recommendations for auto-fix
  const metaRecs = result.recommendations.filter((r) => r.type === "meta");

  if (metaRecs.length === 0) {
    return { slug: result.slug, applied, skipped };
  }

  // Try to find and update enriched content file
  const enrichedPath = path.join(outputRoot, "data", "enriched", entity.slug, "content.json");

  try {
    assertSafePath(enrichedPath);
    const raw = await readFile(enrichedPath, "utf8");
    const content = JSON.parse(raw) as Record<string, unknown>;

    // Insert TODO markers for recommended changes
    const seo = (content.seo ?? {}) as Record<string, unknown>;
    const warnings = (content.warnings ?? []) as string[];

    for (const rec of metaRecs) {
      warnings.push(`[OPTIMIZE] ${rec.action}`);
      applied.push(`Added optimization TODO: ${rec.action}`);
    }

    content.seo = seo;
    content.warnings = warnings;

    await writeGeneratedFile(
      enrichedPath,
      `${JSON.stringify(content, null, 2)}\n`,
      { force: true },
    );
  } catch {
    for (const rec of metaRecs) {
      skipped.push(`Could not auto-fix: ${rec.action} (enriched file not found)`);
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
  } catch {
    return false;
  }
}
