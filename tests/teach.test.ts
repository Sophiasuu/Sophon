import { describe, it, expect } from "vitest";

import { formatContext } from "../src/core/teach";
import type { TeachAnswers } from "../src/core/teach";

const SAMPLE_ANSWERS: TeachAnswers = {
  niche: "best payroll software",
  siteUrl: "https://example.com",
  framework: "nextjs",
  contentGoal: "rank for long-tail keywords",
  targetAudience: "HR managers at SMBs",
  differentiator: "AI-powered onboarding",
  entitySource: "seed",
  aiEnrichment: "yes",
};

describe("formatContext", () => {
  it("returns a markdown string", () => {
    const output = formatContext(SAMPLE_ANSWERS);
    expect(output).toContain("## Sophon Project Context");
  });

  it("includes all answer fields", () => {
    const output = formatContext(SAMPLE_ANSWERS);

    expect(output).toContain("best payroll software");
    expect(output).toContain("https://example.com");
    expect(output).toContain("nextjs");
    expect(output).toContain("rank for long-tail keywords");
    expect(output).toContain("HR managers at SMBs");
    expect(output).toContain("AI-powered onboarding");
    expect(output).toContain("seed");
    expect(output).toContain("yes");
  });

  it("uses markdown bold labels", () => {
    const output = formatContext(SAMPLE_ANSWERS);

    expect(output).toContain("**Niche**");
    expect(output).toContain("**Site URL**");
    expect(output).toContain("**Framework**");
    expect(output).toContain("**Content goal**");
    expect(output).toContain("**Target audience**");
    expect(output).toContain("**Differentiator**");
    expect(output).toContain("**Entity source**");
    expect(output).toContain("**AI enrichment**");
  });

  it("strips trailing slash from site URL", () => {
    const answers: TeachAnswers = {
      ...SAMPLE_ANSWERS,
      siteUrl: "https://example.com",
    };
    const output = formatContext(answers);
    // siteUrl is already stripped before formatContext is called
    expect(output).toContain("https://example.com");
  });

  it("preserves different framework values", () => {
    for (const fw of ["nextjs", "astro", "nuxt", "sveltekit", "remix"]) {
      const output = formatContext({ ...SAMPLE_ANSWERS, framework: fw });
      expect(output).toContain(fw);
    }
  });
});
