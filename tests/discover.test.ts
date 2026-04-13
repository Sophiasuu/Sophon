import { describe, it, expect } from "vitest";
import { discover, DEFAULT_PATTERNS } from "../src/core/discover";

describe("discover", () => {
  it("throws if neither csv nor seed provided", async () => {
    await expect(discover({})).rejects.toThrow("Provide either a csv path or a seed keyword.");
  });

  it("discovers entities from a seed keyword", async () => {
    const result = await discover({ seed: "payroll software" });

    expect(result.mode).toBe("seed");
    expect(result.entityCount).toBe(DEFAULT_PATTERNS.length);
    expect(result.entities.length).toBe(DEFAULT_PATTERNS.length);
    expect(result.generatedAt).toBeTruthy();
  });

  it("produces deterministic entity IDs", async () => {
    const a = await discover({ seed: "payroll software" });
    const b = await discover({ seed: "payroll software" });

    expect(a.entities.map((e) => e.id)).toEqual(b.entities.map((e) => e.id));
  });

  it("uses custom patterns when provided", async () => {
    const result = await discover({
      seed: "crm",
      patterns: ["{seed} tools", "best {seed}"],
    });

    expect(result.entityCount).toBe(2);
    expect(result.entities[0].name).toBe("crm tools");
    expect(result.entities[1].name).toBe("best crm");
  });

  it("deduplicates entities with same slug", async () => {
    const result = await discover({
      seed: "crm",
      patterns: ["{seed} tools", "{seed} Tools"],
    });

    expect(result.entityCount).toBe(1);
  });

  it("entities have correct structure", async () => {
    const result = await discover({
      seed: "crm",
      patterns: ["{seed} pricing"],
    });

    const entity = result.entities[0];
    expect(entity.id).toBeTruthy();
    expect(entity.name).toBe("crm pricing");
    expect(entity.slug).toBe("crm-pricing");
    expect(entity.source).toBe("seed");
    expect(entity.seedKeyword).toBe("crm");
    expect(entity.metadata.title).toBeTruthy();
    expect(entity.metadata.description).toBeTruthy();
    expect(entity.metadata.tags).toContain("crm");
  });

  it("discovers entities from CSV", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    const os = await import("node:os");

    const tmpDir = path.join(os.tmpdir(), `sophon-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    const csvPath = path.join(tmpDir, "test.csv");
    await writeFile(csvPath, "name,category\nAcme CRM,software\nBetaCo,service\n");

    const result = await discover({ csv: csvPath });

    expect(result.mode).toBe("csv");
    expect(result.entityCount).toBe(2);
    expect(result.entities[0].name).toBe("Acme CRM");
    expect(result.entities[0].metadata.attributes?.category).toBe("software");
    expect(result.entities[1].name).toBe("BetaCo");

    const { rm } = await import("node:fs/promises");
    await rm(tmpDir, { recursive: true });
  });

  it("handles CSV with quoted fields containing commas", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    const os = await import("node:os");

    const tmpDir = path.join(os.tmpdir(), `sophon-csv-quoted-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    const csvPath = path.join(tmpDir, "quoted.csv");
    await writeFile(csvPath, 'name,location\n"New York, NY",east\n"San Francisco, CA",west\n');

    const result = await discover({ csv: csvPath });

    expect(result.entityCount).toBe(2);
    expect(result.entities[0].name).toBe("New York, NY");
    expect(result.entities[0].metadata.attributes?.location).toBe("east");

    const { rm } = await import("node:fs/promises");
    await rm(tmpDir, { recursive: true });
  });
});
