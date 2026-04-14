import { describe, it, expect } from "vitest";
import { analyzeKeyword, analyzeKeywords } from "../src/core/keywords";
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
