import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  mapEntitiesToGSC,
  filterMappedEntities,
  filterUnmappedEntities,
} from "../src/core/optimize/entityMapper";
import { analyzeEntity, analyzeAll, calculateScore } from "../src/core/optimize/analyzer";
import { generateRecommendations } from "../src/core/optimize/recommender";
import { buildMetricsFromRows } from "../src/core/optimize/gscClient";
import type {
  EntityRecord,
  GSCPageMetrics,
  GSCQueryRow,
  OptimizationIssueType,
} from "../src/types";

// ── Helpers ─────────────────────────────────────────────────

function makeEntity(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: "abc123",
    name: "payroll software pricing",
    slug: "payroll-software-pricing",
    source: "seed",
    seedKeyword: "payroll software",
    metadata: {
      title: "Payroll Software Pricing",
      description: "Compare payroll software pricing plans.",
      tags: ["payroll", "pricing"],
      attributes: { category: "HR" },
    },
    ...overrides,
  };
}

function makeGSCPage(overrides: Partial<GSCPageMetrics> = {}): GSCPageMetrics {
  return {
    page: "https://example.com/payroll-software-pricing",
    clicks: 120,
    impressions: 4000,
    ctr: 0.03,
    position: 12.4,
    topQueries: [],
    ...overrides,
  };
}

// ── entityMapper ────────────────────────────────────────────

describe("entityMapper", () => {
  describe("mapEntitiesToGSC", () => {
    it("matches entity to GSC page by exact URL", () => {
      const entity = makeEntity();
      const page = makeGSCPage();
      const result = mapEntitiesToGSC([entity], [page], "https://example.com");
      expect(result).toHaveLength(1);
      expect(result[0].metrics).toBeDefined();
      expect(result[0].metrics!.page).toBe(page.page);
    });

    it("matches entity to GSC page with trailing slash", () => {
      const entity = makeEntity();
      const page = makeGSCPage({
        page: "https://example.com/payroll-software-pricing/",
      });
      const result = mapEntitiesToGSC([entity], [page], "https://example.com");
      expect(result[0].metrics).toBeDefined();
    });

    it("returns undefined metrics for unmatched entities", () => {
      const entity = makeEntity({ slug: "unmatched-slug", name: "unmatched slug" });
      const page = makeGSCPage({ page: "https://example.com/totally-different-page" });
      const result = mapEntitiesToGSC([entity], [page], "https://example.com");
      expect(result[0].metrics).toBeUndefined();
    });

    it("maps multiple entities correctly", () => {
      const entities = [
        makeEntity({ slug: "payroll-software-pricing" }),
        makeEntity({ id: "def456", slug: "hr-software-reviews", name: "hr software reviews" }),
      ];
      const pages = [
        makeGSCPage({ page: "https://example.com/payroll-software-pricing" }),
        makeGSCPage({ page: "https://example.com/hr-software-reviews", clicks: 50 }),
      ];
      const result = mapEntitiesToGSC(entities, pages, "https://example.com");
      expect(result).toHaveLength(2);
      expect(result[0].metrics?.clicks).toBe(120);
      expect(result[1].metrics?.clicks).toBe(50);
    });
  });

  describe("filterMappedEntities", () => {
    it("returns only entities with metrics", () => {
      const mapped = [
        { entity: makeEntity(), metrics: makeGSCPage() },
        { entity: makeEntity({ slug: "no-data" }), metrics: undefined },
      ];
      expect(filterMappedEntities(mapped)).toHaveLength(1);
    });
  });

  describe("filterUnmappedEntities", () => {
    it("returns only entities without metrics", () => {
      const mapped = [
        { entity: makeEntity(), metrics: makeGSCPage() },
        { entity: makeEntity({ slug: "no-data" }), metrics: undefined },
      ];
      expect(filterUnmappedEntities(mapped)).toHaveLength(1);
      expect(filterUnmappedEntities(mapped)[0].entity.slug).toBe("no-data");
    });
  });
});

// ── analyzer ────────────────────────────────────────────────

describe("analyzer", () => {
  describe("analyzeEntity", () => {
    it("detects low CTR for position range", () => {
      const result = analyzeEntity({
        entity: makeEntity(),
        metrics: makeGSCPage({ position: 5, ctr: 0.01 }),
      });
      expect(result).toBeDefined();
      expect(result!.issueTypes).toContain("low_ctr");
    });

    it("detects high impressions + low clicks", () => {
      const result = analyzeEntity({
        entity: makeEntity(),
        metrics: makeGSCPage({ impressions: 5000, ctr: 0.01 }),
      });
      expect(result).toBeDefined();
      expect(result!.issueTypes).toContain("high_impressions_low_clicks");
    });

    it("detects striking distance pages", () => {
      const result = analyzeEntity({
        entity: makeEntity(),
        metrics: makeGSCPage({ position: 12 }),
      });
      expect(result).toBeDefined();
      expect(result!.issueTypes).toContain("striking_distance");
    });

    it("detects poor position", () => {
      const result = analyzeEntity({
        entity: makeEntity(),
        metrics: makeGSCPage({ position: 35 }),
      });
      expect(result).toBeDefined();
      expect(result!.issueTypes).toContain("poor_position");
    });

    it("detects low impressions", () => {
      const result = analyzeEntity({
        entity: makeEntity(),
        metrics: makeGSCPage({ impressions: 10, position: 5, ctr: 0.05 }),
      });
      expect(result).toBeDefined();
      expect(result!.issueTypes).toContain("low_impressions");
    });

    it("returns result for entity without GSC data", () => {
      const result = analyzeEntity({
        entity: makeEntity(),
        metrics: undefined,
      });
      expect(result).toBeDefined();
      expect(result!.issues[0]).toContain("No GSC data");
      expect(result!.priority).toBe("high");
    });

    it("assigns high score to well-performing pages", () => {
      const result = analyzeEntity({
        entity: makeEntity(),
        metrics: makeGSCPage({
          position: 2,
          ctr: 0.15,
          clicks: 500,
          impressions: 3000,
        }),
      });
      expect(result).toBeDefined();
      expect(result!.optimizationScore).toBeGreaterThanOrEqual(70);
      expect(result!.priority).toBe("low");
    });
  });

  describe("analyzeAll", () => {
    it("sorts results by optimization score ascending", () => {
      const mapped = [
        { entity: makeEntity({ slug: "good" }), metrics: makeGSCPage({ position: 2, ctr: 0.15, impressions: 3000 }) },
        { entity: makeEntity({ slug: "bad" }), metrics: makeGSCPage({ position: 30, ctr: 0.005, impressions: 20 }) },
      ];
      const results = analyzeAll(mapped);
      expect(results[0].slug).toBe("bad");
      expect(results[1].slug).toBe("good");
    });
  });

  describe("calculateScore", () => {
    it("returns 100 for perfect metrics with no issues", () => {
      const score = calculateScore(
        makeGSCPage({ position: 1, ctr: 0.2, impressions: 5000 }),
        [],
      );
      expect(score).toBe(100);
    });

    it("penalizes poor position", () => {
      const score = calculateScore(
        makeGSCPage({ position: 25, impressions: 500 }),
        [],
      );
      expect(score).toBeLessThan(70);
    });

    it("penalizes multiple issues", () => {
      const issues: OptimizationIssueType[] = [
        "low_ctr",
        "high_impressions_low_clicks",
        "striking_distance",
      ];
      const score = calculateScore(
        makeGSCPage({ position: 12, impressions: 1000, ctr: 0.005 }),
        issues,
      );
      expect(score).toBeLessThan(50);
    });

    it("never returns below 0", () => {
      const issues: OptimizationIssueType[] = [
        "low_ctr",
        "high_impressions_low_clicks",
        "poor_position",
        "low_impressions",
      ];
      const score = calculateScore(
        makeGSCPage({ position: 100, impressions: 5, ctr: 0 }),
        issues,
      );
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── recommender ─────────────────────────────────────────────

describe("recommender", () => {
  describe("generateRecommendations", () => {
    it("generates meta recommendations for CTR issues", () => {
      const recs = generateRecommendations(
        ["low_ctr"],
        makeGSCPage(),
        makeEntity(),
      );
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.some((r) => r.type === "meta")).toBe(true);
    });

    it("generates content and linking recommendations for striking distance", () => {
      const recs = generateRecommendations(
        ["striking_distance"],
        makeGSCPage({ position: 12 }),
        makeEntity(),
      );
      expect(recs.some((r) => r.type === "content")).toBe(true);
      expect(recs.some((r) => r.type === "linking")).toBe(true);
    });

    it("generates structure recommendations for poor position", () => {
      const recs = generateRecommendations(
        ["poor_position"],
        makeGSCPage({ position: 30 }),
        makeEntity(),
      );
      expect(recs.some((r) => r.type === "structure")).toBe(true);
    });

    it("generates indexing recommendations for low impressions", () => {
      const recs = generateRecommendations(
        ["low_impressions"],
        makeGSCPage({ impressions: 10 }),
        makeEntity(),
      );
      expect(recs.some((r) => r.type === "structure")).toBe(true);
    });

    it("deduplicates recommendations", () => {
      const recs = generateRecommendations(
        ["low_ctr", "high_impressions_low_clicks"],
        makeGSCPage(),
        makeEntity(),
      );
      const actions = recs.map((r) => r.action);
      const unique = new Set(actions);
      expect(unique.size).toBe(actions.length);
    });

    it("returns empty array when no rules match", () => {
      const recs = generateRecommendations(
        [],
        makeGSCPage(),
        makeEntity(),
      );
      expect(recs).toHaveLength(0);
    });

    it("includes reasoning for each recommendation", () => {
      const recs = generateRecommendations(
        ["striking_distance"],
        makeGSCPage({ position: 15 }),
        makeEntity(),
      );
      for (const rec of recs) {
        expect(rec.reasoning).toBeDefined();
        expect(rec.reasoning.length).toBeGreaterThan(10);
      }
    });
  });
});

// ── gscClient ───────────────────────────────────────────────

describe("gscClient", () => {
  describe("buildMetricsFromRows", () => {
    it("aggregates rows by page", () => {
      const rows: GSCQueryRow[] = [
        { keys: ["https://example.com/page-a"], clicks: 10, impressions: 100, ctr: 0.1, position: 5 },
        { keys: ["https://example.com/page-a"], clicks: 20, impressions: 200, ctr: 0.1, position: 5 },
        { keys: ["https://example.com/page-b"], clicks: 5, impressions: 50, ctr: 0.1, position: 10 },
      ];
      const metrics = buildMetricsFromRows(rows);
      expect(metrics).toHaveLength(2);

      const pageA = metrics.find((m) => m.page.includes("page-a"));
      expect(pageA).toBeDefined();
      expect(pageA!.clicks).toBe(30);
      expect(pageA!.impressions).toBe(300);
      expect(pageA!.ctr).toBeCloseTo(0.1);
    });

    it("handles empty rows", () => {
      const metrics = buildMetricsFromRows([]);
      expect(metrics).toHaveLength(0);
    });

    it("recalculates CTR for aggregated pages", () => {
      const rows: GSCQueryRow[] = [
        { keys: ["https://example.com/page"], clicks: 10, impressions: 100, ctr: 0.1, position: 3 },
        { keys: ["https://example.com/page"], clicks: 0, impressions: 100, ctr: 0, position: 3 },
      ];
      const metrics = buildMetricsFromRows(rows);
      expect(metrics[0].ctr).toBeCloseTo(0.05);
    });
  });
});

// ── Auto-fixer tests ────────────────────────────────────────

import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { applyAutoFixes } from "../src/core/optimize/optimizer";

describe("applyAutoFixes", () => {
  const testRoot = path.join(process.cwd(), ".test-autofix");
  const enrichedDir = path.join(testRoot, "data", "enriched", "payroll-software-pricing");

  beforeEach(async () => {
    await mkdir(enrichedDir, { recursive: true });
    await writeFile(
      path.join(enrichedDir, "content.json"),
      JSON.stringify({
        seo: {
          title: "Payroll Software Pricing",
          metaDescription: "Payroll software pricing plans and options.",
        },
        content: { intro: "Some intro text.", sections: [], faqs: [] },
        schema: { type: "WebPage", name: "Payroll", description: "pricing" },
        warnings: [],
      }, null, 2),
    );
  });

  afterEach(async () => {
    try { await rm(testRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("rewrites title tag for title recommendation", async () => {
    const entity = makeEntity();
    const result = [{
      entity: "payroll-software-pricing",
      slug: "payroll-software-pricing",
      metrics: { clicks: 100, impressions: 5000, ctr: 0.02, position: 4 },
      optimizationScore: 40,
      issues: ["Low CTR"],
      issueTypes: ["low_ctr" as OptimizationIssueType],
      recommendations: [
        { type: "meta" as const, action: "Rewrite title tag with power words", reasoning: "Low CTR" },
      ],
      priority: "high" as const,
    }];

    const fixes = await applyAutoFixes(result, [entity], testRoot);
    expect(fixes.length).toBe(1);
    expect(fixes[0].applied.some((a) => a.includes("Rewrote title"))).toBe(true);

    // Verify the file was actually modified
    const raw = await readFile(path.join(enrichedDir, "content.json"), "utf8");
    const content = JSON.parse(raw);
    expect(content.seo.title).not.toBe("Payroll Software Pricing");
    expect(content.seo.title).toContain("Guide");
  });

  it("improves meta description for description recommendation", async () => {
    const entity = makeEntity();
    const result = [{
      entity: "payroll-software-pricing",
      slug: "payroll-software-pricing",
      metrics: { clicks: 100, impressions: 5000, ctr: 0.02, position: 4 },
      optimizationScore: 40,
      issues: ["Low CTR"],
      issueTypes: ["low_ctr" as OptimizationIssueType],
      recommendations: [
        { type: "meta" as const, action: "Improve meta description with a clear CTA", reasoning: "Low CTR" },
      ],
      priority: "high" as const,
    }];

    const fixes = await applyAutoFixes(result, [entity], testRoot);
    expect(fixes[0].applied.some((a) => a.includes("meta description"))).toBe(true);

    const raw = await readFile(path.join(enrichedDir, "content.json"), "utf8");
    const content = JSON.parse(raw);
    expect(content.seo.metaDescription).toContain("Compare");
  });

  it("injects missing canonical path", async () => {
    const entity = makeEntity();
    const result = [{
      entity: "payroll-software-pricing",
      slug: "payroll-software-pricing",
      metrics: { clicks: 50, impressions: 1000, ctr: 0.05, position: 15 },
      optimizationScore: 50,
      issues: ["Striking distance"],
      issueTypes: ["striking_distance" as OptimizationIssueType],
      recommendations: [
        { type: "structure" as const, action: "Add FAQ section with schema markup", reasoning: "Striking distance" },
      ],
      priority: "medium" as const,
    }];

    const fixes = await applyAutoFixes(result, [entity], testRoot);
    const raw = await readFile(path.join(enrichedDir, "content.json"), "utf8");
    const content = JSON.parse(raw);
    expect(content.seo.canonicalPath).toBe("/payroll-software-pricing");
  });

  it("injects missing OG fields", async () => {
    const entity = makeEntity();
    const result = [{
      entity: "payroll-software-pricing",
      slug: "payroll-software-pricing",
      metrics: { clicks: 50, impressions: 500, ctr: 0.1, position: 8 },
      optimizationScore: 60,
      issues: ["Striking distance"],
      issueTypes: ["striking_distance" as OptimizationIssueType],
      recommendations: [
        { type: "content" as const, action: "Add content depth", reasoning: "Close to page 1" },
      ],
      priority: "medium" as const,
    }];

    const fixes = await applyAutoFixes(result, [entity], testRoot);

    const raw = await readFile(path.join(enrichedDir, "content.json"), "utf8");
    const content = JSON.parse(raw);
    // OG fields should be auto-injected from existing SEO fields
    expect(content.seo.ogTitle).toBeDefined();
    expect(content.seo.ogDescription).toBeDefined();
  });

  it("creates backup before modifying", async () => {
    const entity = makeEntity();
    const result = [{
      entity: "payroll-software-pricing",
      slug: "payroll-software-pricing",
      metrics: { clicks: 100, impressions: 5000, ctr: 0.02, position: 4 },
      optimizationScore: 40,
      issues: ["Low CTR"],
      issueTypes: ["low_ctr" as OptimizationIssueType],
      recommendations: [
        { type: "meta" as const, action: "Rewrite title tag", reasoning: "Low CTR" },
      ],
      priority: "high" as const,
    }];

    await applyAutoFixes(result, [entity], testRoot);
    const backupPath = path.join(enrichedDir, "content.backup.json");
    const backup = await readFile(backupPath, "utf8");
    const backupContent = JSON.parse(backup);
    expect(backupContent.seo.title).toBe("Payroll Software Pricing");
  });

  it("skips when entity not found", async () => {
    const result = [{
      entity: "nonexistent",
      slug: "nonexistent",
      metrics: { clicks: 0, impressions: 0, ctr: 0, position: 50 },
      optimizationScore: 10,
      issues: [],
      issueTypes: [] as OptimizationIssueType[],
      recommendations: [
        { type: "meta" as const, action: "Fix title", reasoning: "poor" },
      ],
      priority: "critical" as const,
    }];

    const fixes = await applyAutoFixes(result, [makeEntity()], testRoot);
    expect(fixes.length).toBe(0);
  });

  it("adds lastOptimizedAt timestamp", async () => {
    const entity = makeEntity();
    const result = [{
      entity: "payroll-software-pricing",
      slug: "payroll-software-pricing",
      metrics: { clicks: 100, impressions: 5000, ctr: 0.02, position: 4 },
      optimizationScore: 40,
      issues: ["Low CTR"],
      issueTypes: ["low_ctr" as OptimizationIssueType],
      recommendations: [
        { type: "meta" as const, action: "Rewrite title tag", reasoning: "Low CTR" },
      ],
      priority: "high" as const,
    }];

    await applyAutoFixes(result, [entity], testRoot);
    const raw = await readFile(path.join(enrichedDir, "content.json"), "utf8");
    const content = JSON.parse(raw);
    expect(content.lastOptimizedAt).toBeDefined();
    expect(new Date(content.lastOptimizedAt).getTime()).toBeGreaterThan(0);
  });
});
