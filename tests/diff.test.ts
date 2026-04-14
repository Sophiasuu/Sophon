import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { diffGenerate } from "../src/core/diff";
import type { EntityRecord } from "../src/types";

function makeEntity(name: string, slug: string): EntityRecord {
  return {
    id: slug,
    name,
    slug,
    source: "seed",
    seedKeyword: "crm",
    metadata: {
      title: `${name} — Overview`,
      description: `Page for ${name}.`,
      tags: ["crm"],
      attributes: {},
    },
  };
}

describe("diffGenerate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-diff-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("reports all pages as new when output dir is empty", async () => {
    const entities = [makeEntity("CRM Pricing", "crm-pricing"), makeEntity("CRM Tools", "crm-tools")];

    const result = await diffGenerate({
      entities,
      framework: "nextjs",
      output: tmpDir,
    });

    expect(result.newPages).toBe(2);
    expect(result.updatedPages).toBe(0);
    expect(result.unchangedPages).toBe(0);
    expect(result.removedPages).toBe(0);
  });

  it("reports page as unchanged when content matches", async () => {
    const entity = makeEntity("CRM Pricing", "crm-pricing");

    // Generate the page first via adapter
    const { nextjs } = await import("../src/adapters/nextjs");
    const template = nextjs({ entities: [entity], framework: "nextjs" });
    await mkdir(path.join(tmpDir, "crm-pricing"), { recursive: true });
    await writeFile(path.join(tmpDir, "crm-pricing", "page.tsx"), template);

    const result = await diffGenerate({
      entities: [entity],
      framework: "nextjs",
      output: tmpDir,
    });

    expect(result.unchangedPages).toBe(1);
    expect(result.newPages).toBe(0);
  });

  it("reports page as updated when content differs", async () => {
    const entity = makeEntity("CRM Pricing", "crm-pricing");

    await mkdir(path.join(tmpDir, "crm-pricing"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "crm-pricing", "page.tsx"),
      "// SOPHON GENERATED\n// Old content that has changed",
    );

    const result = await diffGenerate({
      entities: [entity],
      framework: "nextjs",
      output: tmpDir,
    });

    expect(result.updatedPages).toBe(1);
    expect(result.newPages).toBe(0);
  });

  it("reports non-Sophon files as unchanged", async () => {
    const entity = makeEntity("CRM Pricing", "crm-pricing");

    await mkdir(path.join(tmpDir, "crm-pricing"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "crm-pricing", "page.tsx"),
      "// Custom page content — not managed by Sophon",
    );

    const result = await diffGenerate({
      entities: [entity],
      framework: "nextjs",
      output: tmpDir,
    });

    expect(result.unchangedPages).toBe(1);
  });

  it("detects removed pages for orphaned Sophon-managed files", async () => {
    // Create a Sophon-managed page for an entity that no longer exists
    await mkdir(path.join(tmpDir, "removed-entity"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "removed-entity", "page.tsx"),
      "// SOPHON GENERATED\nexport default function Page() {}",
    );

    const result = await diffGenerate({
      entities: [makeEntity("CRM Pricing", "crm-pricing")],
      framework: "nextjs",
      output: tmpDir,
    });

    expect(result.removedPages).toBe(1);
    expect(result.changes.find((c) => c.type === "removed")?.slug).toBe("removed-entity");
  });

  it("works with astro (flat file) framework", async () => {
    const entities = [makeEntity("CRM Pricing", "crm-pricing")];

    const result = await diffGenerate({
      entities,
      framework: "astro",
      output: tmpDir,
    });

    expect(result.newPages).toBe(1);
    expect(result.changes[0].path).toContain("crm-pricing.astro");
  });

  it("works with nuxt framework", async () => {
    const result = await diffGenerate({
      entities: [makeEntity("CRM Pricing", "crm-pricing")],
      framework: "nuxt",
      output: tmpDir,
    });

    expect(result.newPages).toBe(1);
    expect(result.changes[0].path).toContain("crm-pricing.vue");
  });

  it("works with sveltekit framework", async () => {
    const result = await diffGenerate({
      entities: [makeEntity("CRM Pricing", "crm-pricing")],
      framework: "sveltekit",
      output: tmpDir,
    });

    expect(result.newPages).toBe(1);
    expect(result.changes[0].path).toContain("+page.svelte");
  });

  it("works with remix framework", async () => {
    const result = await diffGenerate({
      entities: [makeEntity("CRM Pricing", "crm-pricing")],
      framework: "remix",
      output: tmpDir,
    });

    expect(result.newPages).toBe(1);
    expect(result.changes[0].path).toContain("crm-pricing.tsx");
  });

  it("includes all change types in the changes array", async () => {
    // Setup: one new, one updated, one removed
    const entities = [
      makeEntity("New Page", "new-page"),
      makeEntity("Updated Page", "updated-page"),
    ];

    await mkdir(path.join(tmpDir, "updated-page"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "updated-page", "page.tsx"),
      "// SOPHON GENERATED\n// outdated content",
    );

    await mkdir(path.join(tmpDir, "old-page"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "old-page", "page.tsx"),
      "// SOPHON GENERATED\nexport default function OldPage() {}",
    );

    const result = await diffGenerate({
      entities,
      framework: "nextjs",
      output: tmpDir,
    });

    expect(result.newPages).toBe(1);
    expect(result.updatedPages).toBe(1);
    expect(result.removedPages).toBe(1);
    expect(result.changes.length).toBe(3);
  });
});
