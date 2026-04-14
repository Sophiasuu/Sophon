import { describe, it, expect } from "vitest";
import { humanize, humanizeContent, countAiPatterns } from "../src/core/humanize";

describe("humanize", () => {
  it("removes EM dashes", () => {
    expect(humanize("This tool — the best one — works well")).toBe("This tool - the best one - works well");
  });

  it("removes AI filler openers", () => {
    const text = "In today's fast-paced world, CRM systems are essential.";
    expect(humanize(text)).toBe("CRM systems are essential.");
  });

  it("removes 'Let's dive in'", () => {
    expect(humanize("Let's dive in. Here are the details.")).toBe("Here are the details.");
  });

  it("removes 'It's worth noting that'", () => {
    const text = "It's worth noting that pricing varies.";
    expect(humanize(text)).toBe("Pricing varies.");
  });

  it("replaces leverage with use", () => {
    expect(humanize("You can leverage this tool")).toBe("You can use this tool");
  });

  it("replaces utilize with use", () => {
    expect(humanize("Teams utilize the platform daily")).toBe("Teams use the platform daily");
  });

  it("replaces delve into with covers", () => {
    expect(humanize("This guide delves into the details")).toBe("This guide covers the details");
  });

  it("replaces seamlessly with smooth", () => {
    expect(humanize("It integrates seamlessly")).toBe("It integrates smooth");
  });

  it("replaces robust with solid", () => {
    expect(humanize("A robust solution for teams")).toBe("A solid solution for teams");
  });

  it("normalizes smart quotes", () => {
    expect(humanize("\u201Chello\u201D")).toBe('"hello"');
  });

  it("removes multiple AI phrases in one pass", () => {
    const text = "In today's digital landscape, let's dive in. Moreover, you can leverage this robust platform.";
    const result = humanize(text);
    expect(result).not.toContain("dive in");
    expect(result).not.toContain("Moreover");
    expect(result).not.toContain("leverage");
    expect(result).not.toContain("robust");
  });

  it("trims and cleans up spacing", () => {
    const text = "  Hello   world  ";
    expect(humanize(text)).toBe("Hello world");
  });

  it("preserves non-AI text", () => {
    const text = "CRM software helps manage customer relationships.";
    expect(humanize(text)).toBe("CRM software helps manage customer relationships.");
  });

  it("handles empty string", () => {
    expect(humanize("")).toBe("");
  });
});

describe("humanizeContent", () => {
  it("recursively humanizes all strings in an object", () => {
    const obj = {
      title: "Let's dive in. The Overview",
      sections: [{ body: "Moreover, this is robust." }],
    };

    const result = humanizeContent(obj) as Record<string, unknown>;
    expect(result.title).toBe("The Overview");
    expect((result.sections as Array<{ body: string }>)[0].body).toBe("Also, this is solid.");
  });

  it("handles arrays", () => {
    const arr = ["This is robust.", "A seamless integration."];
    const result = humanizeContent(arr) as string[];
    expect(result[0]).toBe("This is solid.");
    expect(result[1]).toBe("A smooth integration.");
  });

  it("passes through non-string primitives", () => {
    expect(humanizeContent(42)).toBe(42);
    expect(humanizeContent(null)).toBe(null);
    expect(humanizeContent(true)).toBe(true);
  });
});

describe("countAiPatterns", () => {
  it("counts AI patterns in text", () => {
    const text = "In today's fast-paced world, you can leverage this robust platform — the best one.";
    expect(countAiPatterns(text)).toBeGreaterThanOrEqual(3);
  });

  it("returns 0 for clean text", () => {
    const text = "CRM software helps teams manage contacts.";
    expect(countAiPatterns(text)).toBe(0);
  });
});

describe("humanize v2 — collision prevention", () => {
  it("prevents double-transition collisions", () => {
    const text = "Therefore, on the other hand the result is clear.";
    const result = humanize(text);
    // Should NOT produce "Therefore, However, the result is clear."
    expect(result).not.toMatch(/Therefore,\s*However,/i);
  });

  it("replaces Moreover with Also instead of removing", () => {
    const text = "Moreover, the pricing is fair.";
    const result = humanize(text);
    expect(result).toBe("Also, the pricing is fair.");
  });

  it("replaces Furthermore with Also", () => {
    const text = "Furthermore, it supports integrations.";
    const result = humanize(text);
    expect(result).toBe("Also, it supports integrations.");
  });

  it("replaces Additionally with Also", () => {
    const text = "Additionally, speed matters.";
    const result = humanize(text);
    expect(result).toBe("Also, speed matters.");
  });

  it("handles orphaned parentheses after removal", () => {
    const text = "This tool () works well.";
    const result = humanize(text);
    expect(result).not.toContain("()");
  });
});
