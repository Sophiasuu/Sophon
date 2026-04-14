/**
 * File-backed caching layer for Sophon.
 * Caches GSC data, enriched content lookups, and keyword analysis results.
 *
 * Cache key = module + input hash.
 * Cache entries expire after configurable TTL (default 1 hour).
 * Stored in .sophon-cache/ directory (gitignored).
 */

import { mkdir, readFile, writeFile, readdir, unlink, stat } from "node:fs/promises";
import path from "node:path";

import { stableHash } from "./utils";

const DEFAULT_CACHE_DIR = ".sophon-cache";
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export type CacheOptions = {
  cacheDir?: string;
  ttlMs?: number;
  enabled?: boolean;
};

type CacheEntry<T> = {
  key: string;
  module: string;
  createdAt: string;
  ttlMs: number;
  data: T;
};

let cacheEnabled = true;
let cacheDir = DEFAULT_CACHE_DIR;
let defaultTtl = DEFAULT_TTL_MS;

export function configureCache(options: CacheOptions): void {
  if (options.enabled !== undefined) cacheEnabled = options.enabled;
  if (options.cacheDir) cacheDir = options.cacheDir;
  if (options.ttlMs) defaultTtl = options.ttlMs;
}

export function isCacheEnabled(): boolean {
  return cacheEnabled;
}

function buildCacheKey(module: string, input: string): string {
  return `${module}-${stableHash(input)}`;
}

function buildCachePath(key: string): string {
  return path.join(cacheDir, `${key}.json`);
}

/**
 * Get a cached value if it exists and hasn't expired.
 */
export async function cacheGet<T>(module: string, input: string, ttlMs?: number): Promise<T | null> {
  if (!cacheEnabled) return null;

  const key = buildCacheKey(module, input);
  const cachePath = buildCachePath(key);
  const ttl = ttlMs ?? defaultTtl;

  try {
    const raw = await readFile(cachePath, "utf8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const age = Date.now() - new Date(entry.createdAt).getTime();

    if (age > ttl) {
      // Expired — remove stale entry
      try { await unlink(cachePath); } catch { /* ignore */ }
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Store a value in the cache.
 */
export async function cacheSet<T>(module: string, input: string, data: T, ttlMs?: number): Promise<void> {
  if (!cacheEnabled) return;

  const key = buildCacheKey(module, input);
  const cachePath = buildCachePath(key);

  const entry: CacheEntry<T> = {
    key,
    module,
    createdAt: new Date().toISOString(),
    ttlMs: ttlMs ?? defaultTtl,
    data,
  };

  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, JSON.stringify(entry, null, 2), "utf8");
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * Invalidate all cache entries for a specific module.
 */
export async function cacheInvalidate(module: string): Promise<number> {
  let removed = 0;
  try {
    const entries = await readdir(cacheDir);
    for (const entry of entries) {
      if (entry.startsWith(`${module}-`) && entry.endsWith(".json")) {
        try {
          await unlink(path.join(cacheDir, entry));
          removed++;
        } catch { /* ignore */ }
      }
    }
  } catch {
    // Cache dir may not exist
  }
  return removed;
}

/**
 * Clear the entire cache.
 */
export async function cacheClear(): Promise<number> {
  let removed = 0;
  try {
    const entries = await readdir(cacheDir);
    for (const entry of entries) {
      if (entry.endsWith(".json")) {
        try {
          await unlink(path.join(cacheDir, entry));
          removed++;
        } catch { /* ignore */ }
      }
    }
  } catch {
    // Cache dir may not exist
  }
  return removed;
}

/**
 * Get cache stats: total entries, total size, entries per module.
 */
export async function cacheStats(): Promise<{
  totalEntries: number;
  totalBytes: number;
  modules: Record<string, number>;
}> {
  const modules: Record<string, number> = {};
  let totalEntries = 0;
  let totalBytes = 0;

  try {
    const entries = await readdir(cacheDir);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      totalEntries++;
      try {
        const filePath = path.join(cacheDir, entry);
        const stats = await stat(filePath);
        totalBytes += stats.size;
        const moduleName = entry.replace(/-[0-9a-f]{8}\.json$/, "");
        modules[moduleName] = (modules[moduleName] ?? 0) + 1;
      } catch { /* ignore */ }
    }
  } catch {
    // Cache dir may not exist
  }

  return { totalEntries, totalBytes, modules };
}
