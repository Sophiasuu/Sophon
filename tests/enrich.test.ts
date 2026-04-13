import { describe, it, expect } from "vitest";

import { messageText, buildUserPrompt } from "../src/core/enrich";
import type { AnthropicMessageResponse } from "../src/core/enrich";
import type { EntityRecord } from "../src/types";

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

describe("messageText", () => {
  it("extracts text from a single text block", () => {
    const response: AnthropicMessageResponse = {
      content: [{ type: "text", text: "hello world" }],
    };
    expect(messageText(response)).toBe("hello world");
  });

  it("concatenates multiple text blocks", () => {
    const response: AnthropicMessageResponse = {
      content: [
        { type: "text", text: "first" },
        { type: "text", text: " second" },
      ],
    };
    expect(messageText(response)).toBe("first second");
  });

  it("ignores non-text blocks", () => {
    const response: AnthropicMessageResponse = {
      content: [
        { type: "tool_use", text: undefined },
        { type: "text", text: "actual content" },
      ],
    };
    expect(messageText(response)).toBe("actual content");
  });

  it("returns empty string for empty content", () => {
    const response: AnthropicMessageResponse = { content: [] };
    expect(messageText(response)).toBe("");
  });

  it("trims whitespace", () => {
    const response: AnthropicMessageResponse = {
      content: [{ type: "text", text: "  trimmed  " }],
    };
    expect(messageText(response)).toBe("trimmed");
  });
});

describe("buildUserPrompt", () => {
  it("returns valid JSON containing the entity", () => {
    const entity = makeEntity();
    const prompt = buildUserPrompt(entity);
    const parsed = JSON.parse(prompt);

    expect(parsed).toHaveProperty("entity");
    expect(parsed.entity.name).toBe("payroll software pricing");
    expect(parsed.entity.slug).toBe("payroll-software-pricing");
  });

  it("includes metadata in the prompt", () => {
    const entity = makeEntity();
    const prompt = buildUserPrompt(entity);
    const parsed = JSON.parse(prompt);

    expect(parsed.entity.metadata.title).toBe("Payroll Software Pricing");
    expect(parsed.entity.metadata.tags).toEqual(["payroll", "pricing"]);
  });

  it("handles entities with minimal metadata", () => {
    const entity = makeEntity({ metadata: {} });
    const prompt = buildUserPrompt(entity);
    const parsed = JSON.parse(prompt);

    expect(parsed.entity.metadata).toEqual({});
  });
});

describe("enrich", () => {
  it("throws if no API key is provided", async () => {
    const { enrich } = await import("../src/core/enrich");
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      await expect(
        enrich({ entities: [makeEntity()], apiKey: undefined }),
      ).rejects.toThrow("ANTHROPIC_API_KEY is required");
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });
});
