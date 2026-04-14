import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { analyzeKeyword, analyzeKeywords, importKeywordData } from "../src/core/keywords";
import type { EntityRecord } from "../src/types";

function makeEntity(name: string, slug?: string): EntityRecord {
  return {
    id: slug ?? name.toLowerCase().replace(/\s+/g, "-"),
    name,
    slug: slug ?? name.toLowerCase().replace(/\s+/g, "-"),
    source: "seed",
    seedKeyword: "crm",
    metadata: {
      title: `${name} Overview`,
      description: `Page about ${name}.`,
      tags: ["crm"],
    },
  };
}

describe("analyzeKeyword", () => {
  it("returns keyword data for an entity", () => {
    const result = analyzeKeyword(makeEntity("CRM Pricing"));

    expect(result.keyword).toBe("CRM Pricing");
    expect(result.slug).toBe("crm-pricing");
    expect(result.estimatedMonthlyVolume).toBeGreaterThan(0);
    expect(result.difficulty).toMatch(/^(easy|medium|hard)$/);
    expect(result.intent).toBeTruthy();
    expect(result.cpcEstimate).toBeTruthy();
    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunityScore).toBeLessThanOrEqual(100);
  });

  it("short keywords have higher estimated volume", () => {
    const short = analyzeKeyword(makeEntity("CRM"));
    const long = analyzeKeyword(makeEntity("best crm for small business startups", "best-crm-sb"));

    expect(short.estimatedMonthlyVolume).toBeGreaterThan(long.estimatedMonthlyVolume);
  });

  it("high-volume modifiers boost estimates", () => {
    const plain = analyzeKeyword(makeEntity("acme CRM tools"));
    const boosted = analyzeKeyword(makeEntity("best CRM tools"));

    expect(boosted.estimatedMonthlyVolume).toBeGreaterThanOrEqual(plain.estimatedMonthlyVolume);
  });

  it("long-tail keywords are classified as easy difficulty", () => {
    const result = analyzeKeyword(makeEntity("best crm for small business teams"));
    expect(result.difficulty).toBe("easy");
  });

  it("commercial intent gets higher CPC estimate", () => {
    const commercial = analyzeKeyword(makeEntity("CRM Pricing"));
    const info = analyzeKeyword(makeEntity("what is CRM"));

    // CPC strings contain dollar amounts, commercial should start higher
    expect(commercial.cpcEstimate).not.toBe(info.cpcEstimate);
  });
});

describe("analyzeKeywords", () => {
  it("returns sorted results by opportunity score", () => {
    const entities = [
      makeEntity("CRM Pricing"),
      makeEntity("CRM Alternatives"),
      makeEntity("best crm for startups"),
      makeEntity("what is CRM"),
    ];

    const results = analyzeKeywords(entities);

    expect(results).toHaveLength(4);

    // Should be sorted descending by opportunity score
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].opportunityScore).toBeGreaterThanOrEqual(results[i + 1].opportunityScore);
    }
  });

  it("handles empty input", () => {
    expect(analyzeKeywords([])).toHaveLength(0);
  });
});

// ── CSV keyword import tests ───────────────────────────────

describe("importKeywordData", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-kw-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("parses basic CSV with keyword and volume columns", async () => {
    const csv = "keyword,volume\nCRM Pricing,5000\nCRM Alternatives,3000\n";
    const csvPath = path.join(tmpDir, "keywords.csv");
    await writeFile(csvPath, csv);

    const data = await importKeywordData(csvPath);
    expect(data.size).toBe(2);
    expect(data.get("crm-pricing")?.volume).toBe(5000);
    expect(data.get("crm-alternatives")?.volume).toBe(3000);
  });

  it("handles Ahrefs-style column names", async () => {
    const csv = "Keyword,Search Volume,Keyword Difficulty,CPC\nbest CRM,8000,45,2.50\n";
    const csvPath = path.join(tmpDir, "ahrefs.csv");
    await writeFile(csvPath, csv);

    const data = await importKeywordData(csvPath);
    expect(data.size).toBe(1);
    const row = data.get("best-crm");
    expect(row?.volume).toBe(8000);
    expect(row?.difficulty).toBe(45);
    expect(row?.cpc).toBe(2.5);
  });

  it("handles SEMrush-style column names", async () => {
    const csv = "Query,Avg Monthly Searches,Competition,Avg CPC\ncrm tools,12000,0.8,$3.00\n";
    const csvPath = path.join(tmpDir, "semrush.csv");
    await writeFile(csvPath, csv);

    const data = await importKeywordData(csvPath);
    expect(data.size).toBe(1);
    expect(data.get("crm-tools")?.volume).toBe(12000);
    expect(data.get("crm-tools")?.cpc).toBe(3.0);
  });

  it("strips currency symbols from CPC", async () => {
    const csv = "keyword,cpc\ncrm pricing,$4.50\ncrm tools,€2.80\n";
    const csvPath = path.join(tmpDir, "cpc.csv");
    await writeFile(csvPath, csv);

    const data = await importKeywordData(csvPath);
    expect(data.get("crm-pricing")?.cpc).toBe(4.5);
    expect(data.get("crm-tools")?.cpc).toBe(2.8);
  });

  it("returns empty map for CSV without keyword column", async () => {
    const csv = "name,value\nfoo,bar\n";
    const csvPath = path.join(tmpDir, "no-keyword.csv");
    await writeFile(csvPath, csv);

    const data = await importKeywordData(csvPath);
    expect(data.size).toBe(0);
  });

  it("returns empty map for empty CSV", async () => {
    const csv = "keyword\n";
    const csvPath = path.join(tmpDir, "empty.csv");
    await writeFile(csvPath, csv);

    const data = await importKeywordData(csvPath);
    expect(data.size).toBe(0);
  });

  it("handles quoted CSV values", async () => {
    const csv = 'keyword,volume\n"CRM for small business",1500\n"best CRM tools, ranked",800\n';
    const csvPath = path.join(tmpDir, "quoted.csv");
    await writeFile(csvPath, csv);

    const data = await importKeywordData(csvPath);
    expect(data.size).toBe(2);
    expect(data.get("crm-for-small-business")?.volume).toBe(1500);
    expect(data.get("best-crm-tools-ranked")?.volume).toBe(800);
  });
});

// ── analyzeKeyword with imported data ──────────────────────

describe("analyzeKeyword with imported data", () => {
  it("uses imported volume when available", () => {
    const imported = new Map([["crm-pricing", { keyword: "CRM Pricing", volume: 9999 }]]);
    const result = analyzeKeyword(makeEntity("CRM Pricing"), imported);
    expect(result.estimatedMonthlyVolume).toBe(9999);
    expect(result.dataSource).toBe("imported");
  });

  it("uses imported difficulty when available", () => {
    const imported = new Map([["crm-pricing", { keyword: "CRM Pricing", difficulty: 15 }]]);
    const result = analyzeKeyword(makeEntity("CRM Pricing"), imported);
    expect(result.difficulty).toBe("easy"); // 15 <= 30 = easy
    expect(result.dataSource).toBe("imported");
  });

  it("falls back to heuristic when no imported data matches", () => {
    const imported = new Map([["other-keyword", { keyword: "Other", volume: 100 }]]);
    const result = analyzeKeyword(makeEntity("CRM Pricing"), imported);
    expect(result.dataSource).toBe("heuristic");
  });

  it("uses imported CPC when available", () => {
    const imported = new Map([["crm-pricing", { keyword: "CRM Pricing", cpc: 7.25 }]]);
    const result = analyzeKeyword(makeEntity("CRM Pricing"), imported);
    expect(result.cpcEstimate).toBe("$7.25");
    expect(result.dataSource).toBe("imported");
  });

  it("analyzeKeywords passes imported data through", () => {
    const imported = new Map([["crm-pricing", { keyword: "CRM Pricing", volume: 50000 }]]);
    const entities = [makeEntity("CRM Pricing")];
    const results = analyzeKeywords(entities, imported);
    expect(results[0].estimatedMonthlyVolume).toBe(50000);
    expect(results[0].dataSource).toBe("imported");
  });
});
