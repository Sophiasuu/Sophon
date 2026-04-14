import { describe, it, expect } from "vitest";
import { generateBlogOutlines } from "../src/core/blog";
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

describe("generateBlogOutlines", () => {
  it("generates outlines for each entity", () => {
    const entities = [makeEntity("CRM Pricing"), makeEntity("CRM Alternatives")];
    const outlines = generateBlogOutlines(entities);

    // Default 2 posts per entity = 4 total
    expect(outlines).toHaveLength(4);
  });

  it("respects postsPerEntity parameter", () => {
    const entities = [makeEntity("CRM Pricing")];
    const outlines = generateBlogOutlines(entities, 1);

    expect(outlines).toHaveLength(1);
  });

  it("outline has correct structure", () => {
    const outlines = generateBlogOutlines([makeEntity("CRM Pricing")], 1);
    const outline = outlines[0];

    expect(outline).toHaveProperty("slug");
    expect(outline).toHaveProperty("parentEntity");
    expect(outline).toHaveProperty("title");
    expect(outline).toHaveProperty("intent");
    expect(outline).toHaveProperty("sections");
    expect(outline).toHaveProperty("internalLinks");
    expect(outline).toHaveProperty("targetKeywords");
  });

  it("slug includes blog prefix", () => {
    const outlines = generateBlogOutlines([makeEntity("CRM Pricing")], 1);
    expect(outlines[0].slug).toContain("blog/");
  });

  it("links back to parent entity", () => {
    const entity = makeEntity("CRM Pricing");
    const outlines = generateBlogOutlines([entity], 1);

    expect(outlines[0].parentEntity).toBe(entity.slug);
    expect(outlines[0].internalLinks).toContain(`/${entity.slug}`);
  });

  it("includes target keywords", () => {
    const entity = makeEntity("CRM Pricing");
    const outlines = generateBlogOutlines([entity], 1);

    expect(outlines[0].targetKeywords).toContain(entity.name);
  });

  it("generates sections list", () => {
    const outlines = generateBlogOutlines([makeEntity("CRM Pricing")], 1);
    expect(outlines[0].sections.length).toBeGreaterThan(0);
  });

  it("handles empty entities", () => {
    expect(generateBlogOutlines([])).toHaveLength(0);
  });

  it("generates different templates for different intents", () => {
    const commercial = generateBlogOutlines([makeEntity("CRM Pricing")], 1);
    const comparison = generateBlogOutlines([makeEntity("CRM Alternatives")], 1);
    const informational = generateBlogOutlines([makeEntity("what is CRM")], 1);

    // Different intents should produce different titles
    expect(commercial[0].title).not.toBe(comparison[0].title);
    expect(comparison[0].title).not.toBe(informational[0].title);
  });
});
