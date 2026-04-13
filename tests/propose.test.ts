import { describe, it, expect } from "vitest";
import { propose } from "../src/core/propose";

describe("propose", () => {
  it("throws if seed is missing", () => {
    expect(() => propose({ seed: "" })).toThrow("--seed is required");
  });

  it("throws if seed is only whitespace", () => {
    expect(() => propose({ seed: "   " })).toThrow("--seed is required");
  });

  it("generates proposed entities from seed", () => {
    const result = propose({ seed: "crm" });

    expect(result.seed).toBe("crm");
    expect(result.totalProposed).toBeGreaterThan(0);
    expect(result.entities.length).toBe(result.totalProposed);
    expect(result.generatedBy).toBe("SOPHON GENERATED PROPOSALS");
    expect(result.generatedAt).toBeTruthy();
  });

  it("respects limit", () => {
    const result = propose({ seed: "crm", limit: 3 });
    expect(result.totalProposed).toBe(3);
    expect(result.entities.length).toBe(3);
  });

  it("entities are sorted by priority descending", () => {
    const result = propose({ seed: "crm" });

    for (let i = 1; i < result.entities.length; i++) {
      expect(result.entities[i - 1].priority).toBeGreaterThanOrEqual(result.entities[i].priority);
    }
  });

  it("deduplicates by slug", () => {
    const result = propose({ seed: "crm", patterns: ["{seed} tools", "{seed} Tools"] });
    const slugs = result.entities.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("groups entities by intent correctly", () => {
    const result = propose({ seed: "crm" });
    const intentSum = Object.values(result.groupedByIntent).reduce((a, b) => a + b, 0);
    expect(intentSum).toBe(result.totalProposed);
  });

  it("each entity has required fields", () => {
    const result = propose({ seed: "crm", limit: 5 });

    for (const entity of result.entities) {
      expect(entity.id).toBeTruthy();
      expect(entity.name).toBeTruthy();
      expect(entity.slug).toBeTruthy();
      expect(["commercial", "comparison", "segmented", "informational"]).toContain(entity.intent);
      expect(entity.priority).toBeGreaterThan(0);
      expect(entity.confidence).toBeGreaterThan(0);
      expect(entity.confidence).toBeLessThanOrEqual(1);
      expect(["keep", "review"]).toContain(entity.action);
      expect(entity.reason).toBeTruthy();
    }
  });
});
