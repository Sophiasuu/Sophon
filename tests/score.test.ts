import { describe, it, expect } from "vitest";
import { scoreEntities } from "../src/core/score";
import type { EntityRecord } from "../src/types";

function makeEntity(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: "abc123",
    name: overrides.name ?? "best crm for agencies",
    slug: overrides.slug ?? "best-crm-for-agencies",
    source: "seed",
    seedKeyword: "crm",
    metadata: {
      title: "Best CRM for Agencies — Overview and Comparison",
      description: "Programmatic SEO placeholder content for best crm for agencies, expanded from the seed keyword crm.",
      tags: ["crm"],
      attributes: { category: "software" },
      ...overrides.metadata,
    },
    ...overrides,
  };
}

describe("scoreEntities", () => {
  it("returns correct structure", () => {
    const result = scoreEntities([makeEntity()]);

    expect(result.entityCount).toBe(1);
    expect(result.averageScore).toBeGreaterThan(0);
    expect(result.averageGrade).toBeTruthy();
    expect(result.entities).toHaveLength(1);
  });

  it("scores a well-formed entity highly", () => {
    const result = scoreEntities([makeEntity()]);
    const scored = result.entities[0];

    expect(scored.score).toBeGreaterThanOrEqual(75);
    expect(["A", "B"]).toContain(scored.grade);
  });

  it("scores an entity with missing metadata lower", () => {
    const result = scoreEntities([
      makeEntity({
        name: "x",
        slug: "x",
        metadata: {
          title: "",
          description: "",
          tags: [],
          attributes: undefined,
        },
      }),
    ]);

    const scored = result.entities[0];
    expect(scored.score).toBeLessThan(60);
  });

  it("handles empty entity list", () => {
    const result = scoreEntities([]);
    expect(result.entityCount).toBe(0);
    expect(result.averageScore).toBe(0);
  });

  it("averages scores across multiple entities", () => {
    const result = scoreEntities([makeEntity(), makeEntity({ name: "x", slug: "x" })]);
    expect(result.entityCount).toBe(2);
    expect(result.averageScore).toBeGreaterThan(0);
  });

  it("each scored entity has 7 checks", () => {
    const result = scoreEntities([makeEntity()]);
    expect(result.entities[0].checks).toHaveLength(7);
  });

  it("flags double-hyphen in slug", () => {
    const result = scoreEntities([makeEntity({ slug: "bad--slug" })]);
    const slugCheck = result.entities[0].checks.find((c) => c.label.includes("slug"));
    expect(slugCheck?.passed).toBe(false);
  });
});
