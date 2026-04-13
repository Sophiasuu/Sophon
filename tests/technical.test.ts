import { describe, it, expect } from "vitest";
import { buildSitemap, buildRobots, buildSchema, buildInternalLinks, buildHreflang } from "../src/core/technical";
import type { EntityRecord } from "../src/types";

function makeEntity(name: string, slug: string, tags: string[] = []): EntityRecord {
  return {
    id: slug,
    name,
    slug,
    source: "seed",
    seedKeyword: "crm",
    metadata: {
      title: `${name} — Overview`,
      description: `Page for ${name}.`,
      tags,
      attributes: {},
    },
  };
}

const entities = [
  makeEntity("CRM Pricing", "crm-pricing", ["crm", "pricing"]),
  makeEntity("CRM Alternatives", "crm-alternatives", ["crm", "tools"]),
  makeEntity("Best CRM", "best-crm", ["crm"]),
];

describe("buildSitemap", () => {
  it("includes all entity URLs", () => {
    const sitemap = buildSitemap("https://example.com", entities);
    expect(sitemap).toContain("<loc>https://example.com/crm-pricing</loc>");
    expect(sitemap).toContain("<loc>https://example.com/crm-alternatives</loc>");
    expect(sitemap).toContain("<loc>https://example.com/best-crm</loc>");
  });

  it("contains valid XML structure", () => {
    const sitemap = buildSitemap("https://example.com", entities);
    expect(sitemap).toContain('<?xml version="1.0"');
    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("</urlset>");
  });

  it("includes lastmod, changefreq, priority", () => {
    const sitemap = buildSitemap("https://example.com", entities);
    expect(sitemap).toContain("<lastmod>");
    expect(sitemap).toContain("<changefreq>weekly</changefreq>");
    expect(sitemap).toContain("<priority>0.7</priority>");
  });
});

describe("buildRobots", () => {
  it("allows all crawlers", () => {
    const robots = buildRobots("https://example.com");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
  });

  it("includes sitemap URL", () => {
    const robots = buildRobots("https://example.com");
    expect(robots).toContain("Sitemap: https://example.com/sitemap.xml");
  });
});

describe("buildSchema", () => {
  it("generates one schema record per entity", () => {
    const schema = buildSchema("https://example.com", entities);
    expect(schema).toHaveLength(3);
  });

  it("includes schema.org context", () => {
    const schema = buildSchema("https://example.com", entities);
    expect(schema[0]["@context"]).toBe("https://schema.org");
  });

  it("uses entity URL", () => {
    const schema = buildSchema("https://example.com", entities);
    expect(schema[0].url).toBe("https://example.com/crm-pricing");
  });
});

describe("buildInternalLinks", () => {
  it("generates links for each entity", () => {
    const links = buildInternalLinks(entities);
    expect(links).toHaveLength(3);
  });

  it("does not link entity to itself", () => {
    const links = buildInternalLinks(entities);
    for (const link of links) {
      expect(link.relatedEntities).not.toContain(link.entity);
    }
  });

  it("scores by shared tags", () => {
    const links = buildInternalLinks(entities);
    const pricingLinks = links.find((l) => l.entity === "crm-pricing");
    expect(pricingLinks?.relatedEntities.length).toBeGreaterThan(0);
  });
});

describe("buildHreflang", () => {
  it("contains entity scaffolds", () => {
    const hreflang = buildHreflang("https://example.com", entities);
    expect(hreflang).toContain("SOPHON GENERATED");
    expect(hreflang).toContain("hreflang");
    expect(hreflang).toContain("https://example.com/crm-pricing");
  });

  it("reports total entity count", () => {
    const hreflang = buildHreflang("https://example.com", entities);
    expect(hreflang).toContain(`Total entities requiring hreflang coverage: ${entities.length}`);
  });
});
