import { describe, it, expect } from "vitest";
import { buildSitemap, buildSitemapIndex, buildRobots, buildSchema, buildBreadcrumbSchema, buildInternalLinks, buildHreflang, buildFaqSchema } from "../src/core/technical";
import type { EntityRecord, EnrichedFaq } from "../src/types";

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
    expect(sitemap).toContain("<changefreq>");
    expect(sitemap).toMatch(/<priority>0\.\d<\/priority>/);
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
      const slugs = link.relatedEntities.map((r) => r.slug);
      expect(slugs).not.toContain(link.entity);
    }
  });

  it("scores by shared tags and intent affinity", () => {
    const links = buildInternalLinks(entities);
    const pricingLinks = links.find((l) => l.entity === "crm-pricing");
    expect(pricingLinks?.relatedEntities.length).toBeGreaterThan(0);
    // Each related entity now has a reason
    expect(pricingLinks?.relatedEntities[0]).toHaveProperty("slug");
    expect(pricingLinks?.relatedEntities[0]).toHaveProperty("reason");
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

describe("buildFaqSchema", () => {
  const enrichedFaqs: EnrichedFaq[] = [
    { question: "What is CRM Pricing?", answer: "CRM pricing covers the various subscription tiers and costs for customer relationship management platforms." },
    { question: "How do I choose a CRM?", answer: "Evaluate your team size, budget, and required integrations to pick the right CRM for your business." },
  ];

  it("returns null without enriched FAQs", () => {
    const faq = buildFaqSchema(entities[0]);
    expect(faq).toBeNull();
  });

  it("returns null with empty enriched FAQs array", () => {
    const faq = buildFaqSchema(entities[0], []);
    expect(faq).toBeNull();
  });

  it("generates FAQ schema from enriched FAQs", () => {
    const faq = buildFaqSchema(entities[0], enrichedFaqs);
    expect(faq).not.toBeNull();
    expect(faq?.["@type"]).toBe("FAQPage");
    expect(faq?.mainEntity).toHaveLength(2);
  });

  it("FAQ entries have Question type with real answers", () => {
    const faq = buildFaqSchema(entities[0], enrichedFaqs)!;
    expect(faq.mainEntity[0]["@type"]).toBe("Question");
    expect(faq.mainEntity[0].name).toBe("What is CRM Pricing?");
    expect(faq.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain("subscription tiers");
  });
});

// ── Sitemap index tests ────────────────────────────────────

describe("buildSitemapIndex", () => {
  it("returns null when entity count is below threshold", () => {
    const result = buildSitemapIndex("https://example.com", entities);
    expect(result).toBeNull();
  });

  it("generates index and child sitemaps for large entity sets", () => {
    // Create 50,000 entities to exceed the 45K threshold
    const manyEntities: EntityRecord[] = [];
    for (let i = 0; i < 50000; i++) {
      manyEntities.push(makeEntity(`Entity ${i}`, `entity-${i}`));
    }

    const result = buildSitemapIndex("https://example.com", manyEntities);
    expect(result).not.toBeNull();
    expect(result!.sitemaps.length).toBe(2); // 45K + 5K = 2 chunks
    expect(result!.index).toContain("<sitemapindex");
    expect(result!.index).toContain("</sitemapindex>");
    expect(result!.index).toContain("sitemap-1.xml");
    expect(result!.index).toContain("sitemap-2.xml");
  });

  it("each child sitemap is valid XML", () => {
    const manyEntities: EntityRecord[] = [];
    for (let i = 0; i < 50000; i++) {
      manyEntities.push(makeEntity(`Entity ${i}`, `entity-${i}`));
    }

    const result = buildSitemapIndex("https://example.com", manyEntities)!;
    for (const sm of result.sitemaps) {
      expect(sm.content).toContain('<?xml version="1.0"');
      expect(sm.content).toContain("<urlset");
      expect(sm.content).toContain("</urlset>");
    }
  });

  it("first child sitemap has 45000 URLs", () => {
    const manyEntities: EntityRecord[] = [];
    for (let i = 0; i < 50000; i++) {
      manyEntities.push(makeEntity(`Entity ${i}`, `entity-${i}`));
    }

    const result = buildSitemapIndex("https://example.com", manyEntities)!;
    const urlCount = (result.sitemaps[0].content.match(/<url>/g) ?? []).length;
    expect(urlCount).toBe(45000);
  });
});

// ── Breadcrumb schema tests ────────────────────────────────

describe("buildBreadcrumbSchema", () => {
  it("generates one breadcrumb per entity", () => {
    const breadcrumbs = buildBreadcrumbSchema("https://example.com", entities);
    expect(breadcrumbs).toHaveLength(3);
  });

  it("has schema.org BreadcrumbList type", () => {
    const breadcrumbs = buildBreadcrumbSchema("https://example.com", entities);
    expect(breadcrumbs[0]["@context"]).toBe("https://schema.org");
    expect(breadcrumbs[0]["@type"]).toBe("BreadcrumbList");
  });

  it("includes Home as first breadcrumb item", () => {
    const breadcrumbs = buildBreadcrumbSchema("https://example.com", entities);
    const items = breadcrumbs[0].itemListElement;
    expect(items[0].position).toBe(1);
    expect(items[0].name).toBe("Home");
    expect(items[0].item).toBe("https://example.com");
  });

  it("includes entity as second breadcrumb item", () => {
    const breadcrumbs = buildBreadcrumbSchema("https://example.com", entities);
    const items = breadcrumbs[0].itemListElement;
    expect(items[1].position).toBe(2);
    expect(items[1].name).toBe("CRM Pricing — Overview");
    expect(items[1].item).toBe("https://example.com/crm-pricing");
  });
});

// ── AggregateRating in schema tests ────────────────────────

describe("buildSchema with AggregateRating", () => {
  it("does not include aggregateRating without rating data", () => {
    const schema = buildSchema("https://example.com", entities);
    expect(schema[0]).not.toHaveProperty("aggregateRating");
  });

  it("includes aggregateRating when ratingValue and ratingCount exist", () => {
    const ratedEntity = makeEntity("Rated CRM", "rated-crm");
    ratedEntity.metadata.attributes = { ratingValue: "4.5", ratingCount: "120", bestRating: "5" };

    const schema = buildSchema("https://example.com", [ratedEntity]);
    expect(schema[0].aggregateRating).toBeDefined();
    expect(schema[0].aggregateRating!["@type"]).toBe("AggregateRating");
    expect(schema[0].aggregateRating!.ratingValue).toBe("4.5");
    expect(schema[0].aggregateRating!.ratingCount).toBe("120");
    expect(schema[0].aggregateRating!.bestRating).toBe("5");
  });

  it("defaults bestRating to 5 when not provided", () => {
    const ratedEntity = makeEntity("Rated CRM", "rated-crm");
    ratedEntity.metadata.attributes = { ratingValue: "4.2", ratingCount: "50" };

    const schema = buildSchema("https://example.com", [ratedEntity]);
    expect(schema[0].aggregateRating!.bestRating).toBe("5");
  });
});

// ── Configurable maxLinks tests ────────────────────────────

describe("buildInternalLinks with maxLinks", () => {
  it("respects custom maxLinks limit", () => {
    const manyEntities = Array.from({ length: 10 }, (_, i) =>
      makeEntity(`CRM Tool ${i}`, `crm-tool-${i}`, ["crm"]),
    );
    const links = buildInternalLinks(manyEntities, 2);
    for (const link of links) {
      expect(link.relatedEntities.length).toBeLessThanOrEqual(2);
    }
  });

  it("defaults to 5 links when maxLinks not specified", () => {
    const manyEntities = Array.from({ length: 10 }, (_, i) =>
      makeEntity(`CRM Tool ${i}`, `crm-tool-${i}`, ["crm"]),
    );
    const links = buildInternalLinks(manyEntities);
    for (const link of links) {
      expect(link.relatedEntities.length).toBeLessThanOrEqual(5);
    }
  });

  it("allows maxLinks of 1", () => {
    const links = buildInternalLinks(entities, 1);
    for (const link of links) {
      expect(link.relatedEntities.length).toBeLessThanOrEqual(1);
    }
  });
});

// ── Sitemap freshness tests ────────────────────────────────

describe("buildSitemap with entity timestamps", () => {
  it("uses enrichedAt for lastmod when available", () => {
    const entityWithTimestamp = makeEntity("Timed Entity", "timed-entity");
    entityWithTimestamp.metadata.enrichedAt = "2024-06-15";

    const sitemap = buildSitemap("https://example.com", [entityWithTimestamp]);
    expect(sitemap).toContain("<lastmod>2024-06-15</lastmod>");
  });

  it("uses generatedAt fallback when enrichedAt is missing", () => {
    const entityWithTimestamp = makeEntity("Gen Entity", "gen-entity");
    entityWithTimestamp.metadata.generatedAt = "2024-05-01";

    const sitemap = buildSitemap("https://example.com", [entityWithTimestamp]);
    expect(sitemap).toContain("<lastmod>2024-05-01</lastmod>");
  });
});

// ── XML escaping tests ─────────────────────────────────────

describe("XML escaping in sitemaps", () => {
  it("escapes special characters in entity slugs", () => {
    const entity = makeEntity("Tom & Jerry", "tom-jerry");
    const sitemap = buildSitemap("https://example.com", [entity]);
    expect(sitemap).toContain("<loc>https://example.com/tom-jerry</loc>");
    // Site URL with & should be escaped
    const sitemapAmp = buildSitemap("https://example.com?a=1&b=2", [entity]);
    expect(sitemapAmp).toContain("&amp;");
    expect(sitemapAmp).not.toMatch(/<loc>[^<]*[^a]&[^a][^<]*<\/loc>/); // no raw & in loc
  });

  it("escapes special characters in robots.txt sitemap URL", () => {
    const robots = buildRobots("https://example.com?param=a&b=2");
    expect(robots).toContain("&amp;");
  });

  it("escapes entity names in hreflang scaffolds", () => {
    const entity = makeEntity("Tom & Jerry's <Show>", "tom-jerry");
    const hreflang = buildHreflang("https://example.com", [entity]);
    expect(hreflang).not.toContain("<Show>");
    expect(hreflang).toContain("&amp;");
  });
});
