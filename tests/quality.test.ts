import { describe, it, expect } from "vitest";
import {
  scoreContent,
  scoreAllContent,
  fleschKincaid,
  trigramOverlap,
} from "../src/core/quality";
import type { EntityRecord } from "../src/types";

function makeEntity(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: "test",
    name: "CRM Pricing",
    slug: "crm-pricing",
    source: "seed",
    seedKeyword: "crm",
    metadata: {
      title: "CRM Pricing: Plans, Costs & What to Expect",
      description: "Compare CRM pricing options and find the right fit for your needs. Features, pricing, and reviews.",
      tags: ["crm"],
    },
    ...overrides,
  };
}

const GOOD_CONTENT = `## CRM Pricing Overview

When evaluating CRM options, pricing is one of the most important factors.
Different vendors offer different pricing tiers depending on team size and features.

## Key Pricing Factors

The main factors that affect CRM pricing include the number of users,
storage requirements, integration needs, and the level of customer support.
Most vendors offer monthly or annual billing options.

## Comparing Plans

Entry-level plans typically start at around twenty dollars per user per month.
Mid-tier plans offer more automation features and custom reporting.
Enterprise plans include dedicated support and advanced analytics.

## Making the Right Choice

Consider your team size, budget, and must-have features when comparing plans.
Many vendors offer free trials so you can test before committing.`;

describe("fleschKincaid", () => {
  it("returns a score between 0 and 100", () => {
    const score = fleschKincaid(GOOD_CONTENT);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 0 for empty text", () => {
    expect(fleschKincaid("")).toBe(0);
  });

  it("simple text scores higher than complex text", () => {
    const simple = "The cat sat on the mat. The dog ran fast. The sun was hot.";
    const complex = "The multifaceted characteristics of organizational infrastructure necessitate comprehensive analytical methodologies.";
    expect(fleschKincaid(simple)).toBeGreaterThan(fleschKincaid(complex));
  });
});

describe("trigramOverlap", () => {
  it("identical texts have high overlap", () => {
    const text = "the quick brown fox jumps over the lazy dog";
    expect(trigramOverlap(text, text)).toBeGreaterThan(0.9);
  });

  it("different texts have low overlap", () => {
    const a = "the quick brown fox jumps over the lazy dog";
    const b = "programming languages include python java and typescript";
    expect(trigramOverlap(a, b)).toBeLessThan(0.2);
  });

  it("returns 0 for empty texts", () => {
    expect(trigramOverlap("", "hello world")).toBe(0);
  });
});

describe("scoreContent", () => {
  it("returns a score with checks", () => {
    const entity = makeEntity();
    const result = scoreContent(entity, GOOD_CONTENT);

    expect(result.slug).toBe("crm-pricing");
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.grade).toBeTruthy();
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it("good content scores well", () => {
    const entity = makeEntity();
    const result = scoreContent(entity, GOOD_CONTENT);
    expect(result.overallScore).toBeGreaterThanOrEqual(50);
  });

  it("empty content scores poorly", () => {
    const entity = makeEntity();
    const result = scoreContent(entity, "");
    expect(result.overallScore).toBeLessThan(50);
  });

  it("checks have proper structure", () => {
    const entity = makeEntity();
    const result = scoreContent(entity, GOOD_CONTENT);

    for (const check of result.checks) {
      expect(check).toHaveProperty("label");
      expect(check).toHaveProperty("score");
      expect(check).toHaveProperty("maxScore");
      expect(check).toHaveProperty("passed");
      expect(check.score).toBeLessThanOrEqual(check.maxScore);
    }
  });

  it("title quality factors into score", () => {
    const goodTitle = makeEntity({
      metadata: {
        title: "CRM Pricing: Plans, Costs & What to Expect",
        description: "Compare CRM pricing options and find the right fit.",
        tags: ["crm"],
      },
    });
    const badTitle = makeEntity({
      metadata: {
        title: "Hi",
        description: "x",
        tags: [],
      },
    });

    const goodScore = scoreContent(goodTitle, GOOD_CONTENT);
    const badScore = scoreContent(badTitle, GOOD_CONTENT);
    expect(goodScore.overallScore).toBeGreaterThan(badScore.overallScore);
  });
});

describe("scoreAllContent", () => {
  it("scores multiple entities", () => {
    const entities = [makeEntity(), makeEntity({ slug: "crm-alt", name: "CRM Alternatives" })];
    const contentMap = new Map([
      ["crm-pricing", GOOD_CONTENT],
      ["crm-alt", "Short content."],
    ]);

    const report = scoreAllContent(entities, contentMap);

    expect(report.entityCount).toBe(2);
    expect(report.averageScore).toBeGreaterThan(0);
    expect(report.entities).toHaveLength(2);
  });

  it("handles empty entity list", () => {
    const report = scoreAllContent([], new Map());
    expect(report.entityCount).toBe(0);
    expect(report.averageScore).toBe(0);
  });
});
