import { describe, it, expect } from "vitest";
import { slugify, stableHash, gradeFromScore } from "../src/core/utils";

describe("slugify", () => {
  it("lowercases and trims", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  it("strips special characters", () => {
    expect(slugify("Best CRM (2024)!")).toBe("best-crm-2024");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("one---two")).toBe("one-two");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("preserves numbers", () => {
    expect(slugify("top 10 tools")).toBe("top-10-tools");
  });
});

describe("stableHash", () => {
  it("returns deterministic 8-char hex", () => {
    const hash = stableHash("hello");
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(stableHash("hello")).toBe(hash);
  });

  it("produces different hashes for different inputs", () => {
    expect(stableHash("a")).not.toBe(stableHash("b"));
  });
});

describe("gradeFromScore", () => {
  it("returns A for 90+", () => {
    expect(gradeFromScore(90)).toBe("A");
    expect(gradeFromScore(100)).toBe("A");
  });

  it("returns B for 75-89", () => {
    expect(gradeFromScore(75)).toBe("B");
    expect(gradeFromScore(89)).toBe("B");
  });

  it("returns C for 60-74", () => {
    expect(gradeFromScore(60)).toBe("C");
    expect(gradeFromScore(74)).toBe("C");
  });

  it("returns D for 45-59", () => {
    expect(gradeFromScore(45)).toBe("D");
    expect(gradeFromScore(59)).toBe("D");
  });

  it("returns F for below 45", () => {
    expect(gradeFromScore(44)).toBe("F");
    expect(gradeFromScore(0)).toBe("F");
  });
});
