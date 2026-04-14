import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { audit } from "../src/core/audit";

describe("audit", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "sophon-audit-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns a score and grade for an empty project", async () => {
    const result = await audit({ root: tmpDir });

    // New deep checks (heading hierarchy, img alt, unique meta) pass vacuously with no files
    expect(result.score).toBe(20);
    expect(result.maxScore).toBeGreaterThan(0);
    expect(result.grade).toBe("F");
    expect(result.checks.length).toBe(12);
  });

  it("detects sitemap.xml in public/", async () => {
    await mkdir(path.join(tmpDir, "public"), { recursive: true });
    await writeFile(path.join(tmpDir, "public", "sitemap.xml"), "<urlset></urlset>");

    const result = await audit({ root: tmpDir });
    const sitemapCheck = result.checks.find((c) => c.label === "Sitemap");

    expect(sitemapCheck?.implemented).toBe(true);
  });

  it("detects robots.txt", async () => {
    await mkdir(path.join(tmpDir, "public"), { recursive: true });
    await writeFile(path.join(tmpDir, "public", "robots.txt"), "User-agent: *\nAllow: /");

    const result = await audit({ root: tmpDir });
    const robotsCheck = result.checks.find((c) => c.label === "Robots");

    expect(robotsCheck?.implemented).toBe(true);
  });

  it("detects canonical tags in source files", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.tsx"),
      '<link rel="canonical" href="/page" />',
    );

    const result = await audit({ root: tmpDir });
    const canonicalCheck = result.checks.find((c) => c.label === "Canonical tags");

    expect(canonicalCheck?.implemented).toBe(true);
  });

  it("detects Open Graph tags", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.tsx"),
      '<meta property="og:title" content="Test" />',
    );

    const result = await audit({ root: tmpDir });
    const ogCheck = result.checks.find((c) => c.label === "Open Graph tags");

    expect(ogCheck?.implemented).toBe(true);
  });

  it("detects Twitter card tags", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.tsx"),
      '<meta name="twitter:card" content="summary_large_image" />',
    );

    const result = await audit({ root: tmpDir });
    const twitterCheck = result.checks.find((c) => c.label === "Twitter card tags");

    expect(twitterCheck?.implemented).toBe(true);
  });

  it("detects JSON-LD structured data", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.tsx"),
      '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
    );

    const result = await audit({ root: tmpDir });
    const schemaCheck = result.checks.find((c) => c.label === "Structured data (JSON-LD)");

    expect(schemaCheck?.implemented).toBe(true);
  });

  it("detects 404 handling via not-found.tsx", async () => {
    await mkdir(path.join(tmpDir, "app"), { recursive: true });
    await writeFile(path.join(tmpDir, "app", "not-found.tsx"), "export default function NotFound() {}");

    const result = await audit({ root: tmpDir });
    const notFoundCheck = result.checks.find((c) => c.label === "404 handling");

    expect(notFoundCheck?.implemented).toBe(true);
  });

  it("detects redirect handling", async () => {
    await mkdir(path.join(tmpDir, "src"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "src", "redirects.ts"),
      'export const redirects = () => [{ source: "/old", destination: "/new", statusCode: 301 }];',
    );

    const result = await audit({ root: tmpDir });
    const redirectCheck = result.checks.find((c) => c.label === "Redirect handling");

    expect(redirectCheck?.implemented).toBe(true);
  });

  it("calculates weighted score correctly", async () => {
    // Add sitemap (weight 15) and robots (weight 10)
    await mkdir(path.join(tmpDir, "public"), { recursive: true });
    await writeFile(path.join(tmpDir, "public", "sitemap.xml"), "<urlset></urlset>");
    await writeFile(path.join(tmpDir, "public", "robots.txt"), "User-agent: *");

    const result = await audit({ root: tmpDir });
    expect(result.score).toBe(45); // 15 + 10 + vacuous passes (heading 5 + alt 5 + unique 10)
  });

  it("normalizes score to 0-100 range", async () => {
    const result = await audit({ root: tmpDir });
    const normalizedScore = Math.round((result.score / result.maxScore) * 100);

    expect(normalizedScore).toBeGreaterThanOrEqual(0);
    expect(normalizedScore).toBeLessThanOrEqual(100);
  });

  it("ignores node_modules directory", async () => {
    await mkdir(path.join(tmpDir, "node_modules", "some-pkg"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "node_modules", "some-pkg", "index.js"),
      '<link rel="canonical" href="/fake" />',
    );

    const result = await audit({ root: tmpDir });
    const canonicalCheck = result.checks.find((c) => c.label === "Canonical tags");

    expect(canonicalCheck?.implemented).toBe(false);
  });

  // ── Deep validation tests ────────────────────────────────

  it("validates JSON-LD schema with required fields", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.tsx"),
      `const schema = { "@context": "https://schema.org", "@type": "WebPage", "name": "Test Page" };`,
    );

    const result = await audit({ root: tmpDir });
    const jsonLdCheck = result.checks.find((c) => c.label === "JSON-LD schema validity");
    expect(jsonLdCheck?.implemented).toBe(true);
  });

  it("fails JSON-LD validation when @type is missing", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.tsx"),
      `const schema = { "@context": "https://schema.org" };`,
    );

    const result = await audit({ root: tmpDir });
    const jsonLdCheck = result.checks.find((c) => c.label === "JSON-LD schema validity");
    expect(jsonLdCheck?.implemented).toBe(false);
  });

  it("detects duplicate titles across files", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "page-a.tsx"),
      `export const meta = { title: "Same Title" };`,
    );
    await writeFile(
      path.join(tmpDir, "pages", "page-b.tsx"),
      `export const meta = { title: "Same Title" };`,
    );

    const result = await audit({ root: tmpDir });
    const dupeCheck = result.checks.find((c) => c.label === "Unique titles and descriptions");
    expect(dupeCheck?.implemented).toBe(false);
  });

  it("passes unique meta when titles differ", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "page-a.tsx"),
      `export const meta = { title: "Page A Title" };`,
    );
    await writeFile(
      path.join(tmpDir, "pages", "page-b.tsx"),
      `export const meta = { title: "Page B Title" };`,
    );

    const result = await audit({ root: tmpDir });
    const dupeCheck = result.checks.find((c) => c.label === "Unique titles and descriptions");
    expect(dupeCheck?.implemented).toBe(true);
  });

  it("detects heading hierarchy violations", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.html"),
      `<html><body><h1>Title</h1><h3>Skipped H2</h3></body></html>`,
    );

    const result = await audit({ root: tmpDir });
    const headingCheck = result.checks.find((c) => c.label === "Heading hierarchy");
    expect(headingCheck?.implemented).toBe(false);
  });

  it("passes heading hierarchy when levels are sequential", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.html"),
      `<html><body><h1>Title</h1><h2>Section</h2><h3>Subsection</h3></body></html>`,
    );

    const result = await audit({ root: tmpDir });
    const headingCheck = result.checks.find((c) => c.label === "Heading hierarchy");
    expect(headingCheck?.implemented).toBe(true);
  });

  it("detects images missing alt text", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.html"),
      `<html><body><img src="photo.jpg"><img src="logo.png" alt="Logo"></body></html>`,
    );

    const result = await audit({ root: tmpDir });
    const imgCheck = result.checks.find((c) => c.label === "Image alt text");
    expect(imgCheck?.implemented).toBe(false);
    expect(imgCheck?.details).toContain("1/2 images missing alt text");
  });

  it("passes image alt text when all images have alt", async () => {
    await mkdir(path.join(tmpDir, "pages"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "pages", "index.html"),
      `<html><body><img src="photo.jpg" alt="A photo"><img src="logo.png" alt="Logo"></body></html>`,
    );

    const result = await audit({ root: tmpDir });
    const imgCheck = result.checks.find((c) => c.label === "Image alt text");
    expect(imgCheck?.implemented).toBe(true);
    expect(imgCheck?.details).toContain("All 2 images have alt text");
  });

  it("includes 12 total checks", async () => {
    const result = await audit({ root: tmpDir });
    expect(result.checks.length).toBe(12);
  });
});
