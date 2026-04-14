import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import {
  configureCache,
  cacheGet,
  cacheSet,
  cacheInvalidate,
  cacheClear,
  cacheStats,
  isCacheEnabled,
} from "../src/core/cache";

const TEST_CACHE_DIR = path.join(process.cwd(), ".test-cache");

describe("cache", () => {
  beforeEach(async () => {
    configureCache({ cacheDir: TEST_CACHE_DIR, enabled: true, ttlMs: 60000 });
    await mkdir(TEST_CACHE_DIR, { recursive: true });
  });

  afterEach(async () => {
    try { await rm(TEST_CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("isCacheEnabled returns true by default", () => {
    expect(isCacheEnabled()).toBe(true);
  });

  it("can disable caching", async () => {
    configureCache({ enabled: false });
    await cacheSet("test", "key1", { data: "hello" });
    const result = await cacheGet("test", "key1");
    expect(result).toBeNull();
    configureCache({ enabled: true });
  });

  it("cacheSet and cacheGet round-trip", async () => {
    await cacheSet("test", "key1", { value: 42, name: "test" });
    const result = await cacheGet<{ value: number; name: string }>("test", "key1");
    expect(result).toEqual({ value: 42, name: "test" });
  });

  it("returns null for missing cache entries", async () => {
    const result = await cacheGet("test", "nonexistent");
    expect(result).toBeNull();
  });

  it("expires entries after TTL", async () => {
    await cacheSet("test", "expiring", "data", 1); // 1ms TTL
    // Wait for expiration
    await new Promise((r) => setTimeout(r, 10));
    const result = await cacheGet("test", "expiring", 1);
    expect(result).toBeNull();
  });

  it("cacheInvalidate removes module-specific entries", async () => {
    await cacheSet("modA", "key1", "data1");
    await cacheSet("modB", "key2", "data2");
    const removed = await cacheInvalidate("modA");
    expect(removed).toBe(1);
    const a = await cacheGet("modA", "key1");
    expect(a).toBeNull();
    const b = await cacheGet("modB", "key2");
    expect(b).toBe("data2");
  });

  it("cacheClear removes all entries", async () => {
    await cacheSet("test", "key1", "data1");
    await cacheSet("test", "key2", "data2");
    const removed = await cacheClear();
    expect(removed).toBe(2);
  });

  it("cacheStats returns correct counts", async () => {
    await cacheSet("test", "key1", "data1");
    await cacheSet("test", "key2", "data2");
    await cacheSet("other", "key3", "data3");
    const stats = await cacheStats();
    expect(stats.totalEntries).toBe(3);
    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.modules.test).toBe(2);
    expect(stats.modules.other).toBe(1);
  });

  it("handles cache strings and arrays", async () => {
    await cacheSet("test", "str", "hello");
    expect(await cacheGet("test", "str")).toBe("hello");

    await cacheSet("test", "arr", [1, 2, 3]);
    expect(await cacheGet("test", "arr")).toEqual([1, 2, 3]);
  });
});
