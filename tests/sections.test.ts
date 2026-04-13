import { describe, it, expect } from "vitest";
import { getSections } from "../src/core/sections";

describe("getSections", () => {
  it("returns 4 sections for commercial intent", () => {
    const sections = getSections("commercial");
    expect(sections).toHaveLength(4);
    expect(sections[0].heading).toContain("Pricing");
  });

  it("returns 4 sections for comparison intent", () => {
    const sections = getSections("comparison");
    expect(sections).toHaveLength(4);
    expect(sections[0].heading).toContain("Side-by-Side");
  });

  it("returns 4 sections for segmented intent", () => {
    const sections = getSections("segmented");
    expect(sections).toHaveLength(4);
    expect(sections[0].heading).toContain("Pain Points");
  });

  it("returns 4 sections for informational intent", () => {
    const sections = getSections("informational");
    expect(sections).toHaveLength(4);
    expect(sections[0].heading).toContain("What You Need");
  });

  it("all sections have heading and placeholder", () => {
    for (const intent of ["commercial", "comparison", "segmented", "informational"] as const) {
      for (const section of getSections(intent)) {
        expect(section.heading).toBeTruthy();
        expect(section.placeholder).toBeTruthy();
      }
    }
  });
});
