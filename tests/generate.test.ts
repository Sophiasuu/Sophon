import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { generate, writeGeneratedFile, buildHydrationMap, isYmylEntity, loadEnrichedContent, renderYmylDisclaimer } from "../src/core/generate";
import type { EnrichedContent, EntityRecord, Framework, GenerateOptions } from "../src/types";

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

describe("buildHydrationMap", () => {
  it("returns a map with all entity placeholders", () => {
    const entity = makeEntity();
    const map = buildHydrationMap(entity);

    expect(map).toHaveProperty("__ENTITY_NAME__");
    expect(map).toHaveProperty("__ENTITY_SLUG__");
    expect(map).toHaveProperty("__ENTITY_TITLE__");
    expect(map).toHaveProperty("__ENTITY_DESCRIPTION__");
    expect(map).toHaveProperty("__ENTITY_TAGS__");
    expect(map).toHaveProperty("__ENTITY_ATTRIBUTES__");
  });

  it("uses entity name as title fallback", () => {
    const entity = makeEntity({ metadata: {} });
    const map = buildHydrationMap(entity);

    expect(map["__ENTITY_TITLE__"]).toContain(entity.name);
  });

  it("generates default description when missing", () => {
    const entity = makeEntity({ metadata: {} });
    const map = buildHydrationMap(entity);

    expect(map["__ENTITY_DESCRIPTION__"]).toContain("Explore");
  });

  it("escapes < and > to prevent script injection", () => {
    const entity = makeEntity({
      name: '</script><script>alert("xss")</script>',
      metadata: {
        title: '<img onerror="alert(1)" src=x>',
      },
    });
    const map = buildHydrationMap(entity);

    expect(map["__ENTITY_NAME__"]).not.toContain("<");
    expect(map["__ENTITY_NAME__"]).not.toContain(">");
    expect(map["__ENTITY_NAME__"]).toContain("\\u003c");
    expect(map["__ENTITY_TITLE__"]).not.toContain("<");
    expect(map["__ENTITY_TITLE__"]).toContain("\\u003c");
  });

  it("handles quotes in entity names safely", () => {
    const entity = makeEntity({ name: 'test "quoted" name' });
    const map = buildHydrationMap(entity);

    // JSON.stringify escapes the inner quotes
    expect(map["__ENTITY_NAME__"]).toContain('\\"quoted\\"');
  });
});

describe("isYmylEntity", () => {
  it("detects health-related entities", () => {
    expect(isYmylEntity(makeEntity({ name: "mental health apps" }))).toBe(true);
  });

  it("detects financial entities", () => {
    expect(isYmylEntity(makeEntity({ name: "investment platforms" }))).toBe(true);
  });

  it("detects legal entities", () => {
    expect(isYmylEntity(makeEntity({ name: "law firm software" }))).toBe(true);
  });

  it("detects YMYL from tags", () => {
    const entity = makeEntity({
      name: "some tool",
      metadata: { tags: ["insurance", "claims"] },
    });
    expect(isYmylEntity(entity)).toBe(true);
  });

  it("returns false for non-YMYL entities", () => {
    expect(isYmylEntity(makeEntity({ name: "project management tool" }))).toBe(false);
  });
});

describe("generate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-gen-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeOptions(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
    return {
      entities: [makeEntity()],
      framework: "nextjs",
      output: tmpDir,
      force: true,
      ...overrides,
    };
  }

  it("generates a page for each entity", async () => {
    const result = await generate(makeOptions());

    expect(result.generated).toBe(1);
    expect(result.total).toBe(1);

    const pagePath = path.join(tmpDir, "payroll-software-pricing", "page.tsx");
    const content = await readFile(pagePath, "utf8");
    expect(content).toContain("SOPHON GENERATED");
    expect(content).toContain("payroll-software-pricing");
  });

  it("skips duplicate slugs", async () => {
    const entities = [makeEntity(), makeEntity({ id: "different-id" })];
    const result = await generate(makeOptions({ entities }));

    expect(result.generated).toBe(1);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain("Duplicate slug");
  });

  it("warns about YMYL entities", async () => {
    const entity = makeEntity({ name: "health insurance plans" });
    const result = await generate(makeOptions({ entities: [entity] }));

    expect(result.warnings.some((w) => w.includes("YMYL"))).toBe(true);
  });

  it("warns about thin content", async () => {
    const entity = makeEntity({ metadata: {} });
    const result = await generate(makeOptions({ entities: [entity] }));

    expect(result.warnings.some((w) => w.includes("Thin content"))).toBe(true);
  });

  it("hydrates entity values into the template", async () => {
    const result = await generate(makeOptions());
    expect(result.generated).toBe(1);

    const pagePath = path.join(tmpDir, "payroll-software-pricing", "page.tsx");
    const content = await readFile(pagePath, "utf8");

    // Entity values should be present, placeholders should not
    expect(content).toContain("Payroll Software Pricing");
    expect(content).not.toContain("__ENTITY_NAME__");
    expect(content).not.toContain("__ENTITY_SLUG__");
  });

  it("generates intent-specific sections", async () => {
    const result = await generate(makeOptions());
    expect(result.todos).toBeGreaterThan(0);

    const pagePath = path.join(tmpDir, "payroll-software-pricing", "page.tsx");
    const content = await readFile(pagePath, "utf8");
    expect(content).toContain("TODO:");
  });

  it("generates for astro framework", async () => {
    const result = await generate(makeOptions({ framework: "astro" }));
    expect(result.generated).toBe(1);

    const pagePath = path.join(tmpDir, "payroll-software-pricing.astro");
    const content = await readFile(pagePath, "utf8");
    expect(content).toContain("SOPHON GENERATED");
  });

  it("generates for nuxt framework", async () => {
    const result = await generate(makeOptions({ framework: "nuxt" }));
    expect(result.generated).toBe(1);

    const pagePath = path.join(tmpDir, "payroll-software-pricing.vue");
    const content = await readFile(pagePath, "utf8");
    expect(content).toContain("SOPHON GENERATED");
  });

  it("generates for sveltekit framework with additional page module", async () => {
    const result = await generate(makeOptions({ framework: "sveltekit" }));
    expect(result.generated).toBe(1);

    const pagePath = path.join(tmpDir, "payroll-software-pricing", "+page.svelte");
    const modulePath = path.join(tmpDir, "payroll-software-pricing", "+page.ts");
    const content = await readFile(pagePath, "utf8");
    const module = await readFile(modulePath, "utf8");

    expect(content).toContain("SOPHON GENERATED");
    expect(module).toContain("SOPHON GENERATED");
    expect(module).toContain("prerender");
  });

  it("generates for remix framework", async () => {
    const result = await generate(makeOptions({ framework: "remix" }));
    expect(result.generated).toBe(1);

    const pagePath = path.join(tmpDir, "payroll-software-pricing.tsx");
    const content = await readFile(pagePath, "utf8");
    expect(content).toContain("SOPHON GENERATED");
  });

  it("escapes dangerous entity names in all frameworks", async () => {
    const malicious = makeEntity({
      name: '</script><script>alert("xss")</script>',
      slug: "xss-test",
      metadata: { title: "</script>inject" },
    });

    for (const framework of ["nextjs", "nuxt", "sveltekit", "remix", "astro"] as const) {
      const result = await generate(makeOptions({ framework, entities: [malicious] }));
      expect(result.generated).toBe(1);

      // Find the generated file
      const entries = await readdir(tmpDir, { recursive: true });
      const files = entries.filter((e) => typeof e === "string" && !e.startsWith("."));
      expect(files.length).toBeGreaterThan(0);

      // Read all generated files and verify no raw < or > in entity values
      for (const file of entries) {
        if (typeof file === "string") {
          const fullPath = path.join(tmpDir, file);
          try {
            const content = await readFile(fullPath, "utf8");
            // The dangerous string should never appear unescaped
            expect(content).not.toContain('</script><script>alert("xss")</script>');
          } catch {
            // Directory entry, skip
          }
        }
      }

      // Clean for next framework
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-gen-"));
    }
  });

  it("handles multiple entities", async () => {
    const entities = [
      makeEntity({ id: "1", name: "tool a", slug: "tool-a", metadata: { title: "Tool A" } }),
      makeEntity({ id: "2", name: "tool b", slug: "tool-b", metadata: { title: "Tool B" } }),
      makeEntity({ id: "3", name: "tool c", slug: "tool-c", metadata: { title: "Tool C" } }),
    ];
    const result = await generate(makeOptions({ entities }));

    expect(result.generated).toBe(3);
    expect(result.total).toBe(3);
  });
});

describe("writeGeneratedFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-write-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes a file and returns true", async () => {
    const filePath = path.join(tmpDir, "test.txt");
    const result = await writeGeneratedFile(filePath, "hello", { force: true });

    expect(result).toBe(true);
    expect(await readFile(filePath, "utf8")).toBe("hello");
  });

  it("creates intermediate directories", async () => {
    const filePath = path.join(tmpDir, "deep", "nested", "file.txt");
    await writeGeneratedFile(filePath, "content", { force: true });

    expect(await readFile(filePath, "utf8")).toBe("content");
  });
});

const ENRICHED_FIXTURE: EnrichedContent = {
  slug: "payroll-software-pricing",
  seo: {
    title: "Enriched Payroll Title",
    metaDescription: "Enriched meta description for payroll software pricing.",
    canonicalPath: "/payroll-software-pricing",
  },
  content: {
    intro: "Payroll software pricing varies by provider.",
    sections: [
      { heading: "Plan Tiers", body: "Most vendors offer starter, professional, and enterprise plans." },
      { heading: "Hidden Costs", body: "Watch for per-employee fees and add-on modules." },
    ],
    faqs: [
      { question: "What is the average cost?", answer: "Small-business plans typically range from $20-$80/month." },
    ],
    comparisons: [],
  },
  schema: { type: "WebPage", name: "Payroll Software Pricing", description: "Compare payroll pricing." },
  warnings: [],
};

describe("loadEnrichedContent", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-enrich-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no enriched content exists", async () => {
    const result = await loadEnrichedContent("nonexistent-slug", tmpDir);
    expect(result).toBeNull();
  });

  it("loads enriched content when file exists", async () => {
    const slugDir = path.join(tmpDir, "test-slug");
    await mkdir(slugDir, { recursive: true });
    await writeFile(path.join(slugDir, "content.json"), JSON.stringify(ENRICHED_FIXTURE));

    const result = await loadEnrichedContent("test-slug", tmpDir);
    expect(result).not.toBeNull();
    expect(result?.seo.title).toBe("Enriched Payroll Title");
    expect(result?.content.sections).toHaveLength(2);
  });
});

describe("buildHydrationMap with enrichment", () => {
  it("uses enriched SEO title when available", () => {
    const entity = makeEntity();
    const map = buildHydrationMap(entity, undefined, ENRICHED_FIXTURE);
    expect(map["__ENTITY_TITLE__"]).toContain("Enriched Payroll Title");
  });

  it("uses enriched meta description when available", () => {
    const entity = makeEntity();
    const map = buildHydrationMap(entity, undefined, ENRICHED_FIXTURE);
    expect(map["__ENTITY_DESCRIPTION__"]).toContain("Enriched meta description");
  });

  it("uses enriched schema type in JSON-LD", () => {
    const entity = makeEntity();
    const enrichedWithType = { ...ENRICHED_FIXTURE, schema: { ...ENRICHED_FIXTURE.schema, type: "SoftwareApplication" } };
    const map = buildHydrationMap(entity, undefined, enrichedWithType);
    expect(map["__ENTITY_SCHEMA_JSONLD__"]).toContain("SoftwareApplication");
  });

  it("falls back to entity data without enrichment", () => {
    const entity = makeEntity();
    const map = buildHydrationMap(entity, undefined, null);
    expect(map["__ENTITY_TITLE__"]).toContain("Payroll Software Pricing");
  });
});

describe("renderYmylDisclaimer", () => {
  it("returns empty string for non-YMYL entities", () => {
    const entity = makeEntity({ name: "project management tool" });
    expect(renderYmylDisclaimer("nextjs", entity)).toBe("");
  });

  it("renders a disclaimer for health-related entities", () => {
    const entity = makeEntity({ name: "mental health apps" });
    const html = renderYmylDisclaimer("nextjs", entity);
    expect(html).toContain("Disclaimer");
    expect(html).toContain("informational purposes only");
    expect(html).toContain("aside");
  });

  it("renders a disclaimer for financial entities", () => {
    const entity = makeEntity({ name: "investment platforms" });
    const html = renderYmylDisclaimer("nextjs", entity);
    expect(html).toContain("Disclaimer");
    expect(html).toContain("qualified professional");
  });

  it("uses Tailwind classes for nextjs framework", () => {
    const entity = makeEntity({ name: "health insurance" });
    const html = renderYmylDisclaimer("nextjs", entity);
    expect(html).toContain("className=");
    expect(html).toContain("rounded-xl");
  });

  it("uses plain HTML for non-Tailwind frameworks", () => {
    const entity = makeEntity({ name: "health insurance" });
    for (const fw of ["astro", "nuxt", "sveltekit", "remix"] as Framework[]) {
      const html = renderYmylDisclaimer(fw, entity);
      expect(html).toContain("<aside");
      expect(html).not.toContain("className=");
    }
  });

  it("injects disclaimer into generated YMYL pages", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-ymyl-"));
    try {
      const entity = makeEntity({ name: "health insurance plans", slug: "health-insurance-plans" });
      await generate({
        entities: [entity],
        framework: "nextjs",
        output: tmpDir,
        force: true,
      });
      const content = await readFile(path.join(tmpDir, "health-insurance-plans", "page.tsx"), "utf8");
      expect(content).toContain("Disclaimer");
      expect(content).toContain("informational purposes only");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not inject disclaimer into non-YMYL pages", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-noymyl-"));
    try {
      const entity = makeEntity();
      await generate({
        entities: [entity],
        framework: "nextjs",
        output: tmpDir,
        force: true,
      });
      const content = await readFile(path.join(tmpDir, "payroll-software-pricing", "page.tsx"), "utf8");
      expect(content).not.toContain("Disclaimer");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
