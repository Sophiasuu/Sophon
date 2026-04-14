import { slugify } from "../utils";
import type { EntityRecord, GSCPageMetrics } from "../../types";

export type MappedEntity = {
  entity: EntityRecord;
  metrics: GSCPageMetrics | undefined;
};

/**
 * Map GSC page metrics to Sophon entities by matching URL slugs.
 *
 * Matching strategy (in order):
 * 1. Exact slug match in URL path
 * 2. URL path ends with entity slug
 * 3. Slug appears anywhere in URL path
 */
export function mapEntitiesToGSC(
  entities: EntityRecord[],
  gscPages: GSCPageMetrics[],
  siteUrl: string,
): MappedEntity[] {
  const normalizedSite = siteUrl.replace(/\/+$/, "");

  return entities.map((entity) => {
    const metrics = findMatchingPage(entity, gscPages, normalizedSite);
    return { entity, metrics };
  });
}

function findMatchingPage(
  entity: EntityRecord,
  gscPages: GSCPageMetrics[],
  siteUrl: string,
): GSCPageMetrics | undefined {
  const slug = entity.slug;
  const expectedUrl = `${siteUrl}/${slug}`;

  // Strategy 1: exact URL match
  const exact = gscPages.find(
    (p) => normalizeUrl(p.page) === normalizeUrl(expectedUrl),
  );
  if (exact) return exact;

  // Strategy 2: URL path ends with slug
  const endsWith = gscPages.find((p) => {
    const path = urlPath(p.page);
    return path === `/${slug}` || path === `/${slug}/`;
  });
  if (endsWith) return endsWith;

  // Strategy 3: slug appears in path
  const contains = gscPages.find((p) => {
    const path = urlPath(p.page);
    return path.includes(`/${slug}`);
  });
  if (contains) return contains;

  // Strategy 4: fuzzy match using slugified entity name against page path segments
  const entitySlug = slugify(entity.name);
  const fuzzy = gscPages.find((p) => {
    const segments = urlPath(p.page)
      .split("/")
      .filter(Boolean);
    return segments.some((seg) => slugify(seg) === entitySlug);
  });

  return fuzzy;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase();
}

function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Returns only entities that have matching GSC data (mapped entities).
 */
export function filterMappedEntities(mapped: MappedEntity[]): MappedEntity[] {
  return mapped.filter((m) => m.metrics !== undefined);
}

/**
 * Returns entities that have no GSC data (unmapped / not indexed).
 */
export function filterUnmappedEntities(mapped: MappedEntity[]): MappedEntity[] {
  return mapped.filter((m) => m.metrics === undefined);
}
