import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { AuditCheck, AuditResult } from "../types";
import { gradeFromScore } from "./utils";

type AuditOptions = {
  root?: string;
};

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".svelte-kit", ".nuxt"]);

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}

async function hasPattern(files: string[], pattern: RegExp): Promise<boolean> {
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|astro|vue|svelte|mdx|html)$/i.test(file)) {
      continue;
    }

    try {
      const content = await readFile(file, "utf8");

      if (pattern.test(content)) {
        return true;
      }
    } catch {
      // Ignore unreadable files.
    }
  }

  return false;
}

// ── Deep validation helpers ────────────────────────────────

async function validateJsonLdSchema(files: string[]): Promise<{ valid: boolean; details: string }> {
  const requiredFields = ["@context", "@type", "name"];
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|astro|vue|svelte|html|json)$/i.test(file)) continue;
    try {
      const content = await readFile(file, "utf8");
      const matches = content.match(/"@context"\s*:\s*"https:\/\/schema\.org"/g);
      if (matches) {
        // Check that @type and name exist nearby
        const hasType = /"@type"\s*:/.test(content);
        const hasName = /"name"\s*:/.test(content);
        if (!hasType || !hasName) {
          return { valid: false, details: `JSON-LD in ${path.basename(file)} missing required fields (need: ${requiredFields.join(", ")})` };
        }
        return { valid: true, details: "JSON-LD schema has required fields" };
      }
    } catch { /* skip */ }
  }
  return { valid: false, details: "No JSON-LD schema found" };
}

async function checkDuplicateMeta(files: string[]): Promise<{ unique: boolean; details: string }> {
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  const duplicates: string[] = [];

  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|astro|vue|svelte)$/i.test(file)) continue;
    try {
      const content = await readFile(file, "utf8");
      const titleMatch = content.match(/title:\s*["'`]([^"'`]+)["'`]/);
      const descMatch = content.match(/description:\s*["'`]([^"'`]+)["'`]/);

      if (titleMatch?.[1]) {
        const title = titleMatch[1];
        if (titles.has(title)) {
          duplicates.push(`Duplicate title "${title.slice(0, 40)}..." in ${path.basename(file)} and ${titles.get(title)}`);
        }
        titles.set(title, path.basename(file));
      }

      if (descMatch?.[1]) {
        const desc = descMatch[1];
        if (descriptions.has(desc)) {
          duplicates.push(`Duplicate description in ${path.basename(file)} and ${descriptions.get(desc)}`);
        }
        descriptions.set(desc, path.basename(file));
      }
    } catch { /* skip */ }
  }

  return {
    unique: duplicates.length === 0,
    details: duplicates.length > 0 ? duplicates.slice(0, 3).join("; ") : "No duplicate titles or descriptions detected",
  };
}

async function checkHeadingHierarchy(files: string[]): Promise<{ valid: boolean; details: string }> {
  let checked = 0;
  let violations = 0;

  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|astro|vue|svelte|html)$/i.test(file)) continue;
    try {
      const content = await readFile(file, "utf8");
      const headings = [...content.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number.parseInt(m[1], 10));
      if (headings.length === 0) continue;
      checked++;

      // Check for h1 presence
      if (!headings.includes(1)) {
        violations++;
        continue;
      }

      // Check for heading level skips (e.g. h1 -> h3)
      for (let i = 1; i < headings.length; i++) {
        if (headings[i] > headings[i - 1] + 1) {
          violations++;
          break;
        }
      }
    } catch { /* skip */ }
  }

  if (checked === 0) return { valid: true, details: "No heading hierarchy to check" };
  return {
    valid: violations === 0,
    details: violations > 0 ? `${violations}/${checked} files have heading hierarchy issues (skipped levels or missing H1)` : "Heading hierarchy is clean",
  };
}

async function checkImgAltText(files: string[]): Promise<{ valid: boolean; details: string }> {
  let totalImages = 0;
  let missingAlt = 0;

  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|astro|vue|svelte|html)$/i.test(file)) continue;
    try {
      const content = await readFile(file, "utf8");
      const imgs = content.match(/<img\b[^>]*>/gi) ?? [];
      totalImages += imgs.length;
      for (const img of imgs) {
        if (!/\balt\s*=/i.test(img)) {
          missingAlt++;
        }
      }
    } catch { /* skip */ }
  }

  if (totalImages === 0) return { valid: true, details: "No images found" };
  return {
    valid: missingAlt === 0,
    details: missingAlt > 0 ? `${missingAlt}/${totalImages} images missing alt text` : `All ${totalImages} images have alt text`,
  };
}

export async function audit(options: AuditOptions = {}): Promise<AuditResult> {
  const root = options.root ?? process.cwd();
  const files = await walkFiles(root);

  // Run deep validations
  const [jsonLdValidation, duplicateMeta, headingCheck, imgAltCheck] = await Promise.all([
    validateJsonLdSchema(files),
    checkDuplicateMeta(files),
    checkHeadingHierarchy(files),
    checkImgAltText(files),
  ]);

  const checks: AuditCheck[] = [
    {
      label: "Sitemap",
      implemented:
        (await exists(path.join(root, "public", "sitemap.xml"))) ||
        (await exists(path.join(root, "static", "sitemap.xml"))) ||
        (await exists(path.join(root, "sitemap.xml"))),
      weight: 15,
      details: "Expected one of: public/sitemap.xml, static/sitemap.xml, sitemap.xml",
    },
    {
      label: "Robots",
      implemented:
        (await exists(path.join(root, "public", "robots.txt"))) ||
        (await exists(path.join(root, "static", "robots.txt"))) ||
        (await exists(path.join(root, "robots.txt"))),
      weight: 10,
      details: "Expected one of: public/robots.txt, static/robots.txt, robots.txt",
    },
    {
      label: "Canonical tags",
      implemented: await hasPattern(files, /rel=["']canonical["']/i),
      weight: 20,
      details: "Detected by rel=\"canonical\" in page/head code",
    },
    {
      label: "Open Graph tags",
      implemented: await hasPattern(files, /og:title|openGraph/i),
      weight: 15,
      details: "Detected by og:* tags or openGraph metadata objects",
    },
    {
      label: "Twitter card tags",
      implemented: await hasPattern(files, /twitter:card|twitter\s*:\s*\{/i),
      weight: 10,
      details: "Detected by twitter:card tags or twitter metadata objects",
    },
    {
      label: "Structured data (JSON-LD)",
      implemented: await hasPattern(files, /application\/ld\+json|"@context"\s*:\s*"https:\/\/schema.org"/i),
      weight: 10,
      details: "Detected by JSON-LD script or schema.org context",
    },
    {
      label: "JSON-LD schema validity",
      implemented: jsonLdValidation.valid,
      weight: 5,
      details: jsonLdValidation.details,
    },
    {
      label: "Unique titles and descriptions",
      implemented: duplicateMeta.unique,
      weight: 10,
      details: duplicateMeta.details,
    },
    {
      label: "Heading hierarchy",
      implemented: headingCheck.valid,
      weight: 5,
      details: headingCheck.details,
    },
    {
      label: "Image alt text",
      implemented: imgAltCheck.valid,
      weight: 5,
      details: imgAltCheck.details,
    },
    {
      label: "404 handling",
      implemented:
        (await exists(path.join(root, "app", "not-found.tsx"))) ||
        (await exists(path.join(root, "pages", "404.tsx"))) ||
        (await exists(path.join(root, "src", "routes", "+error.svelte"))),
      weight: 5,
      details: "Detected common framework 404 conventions",
    },
    {
      label: "Redirect handling",
      implemented: await hasPattern(files, /redirects\s*\(|\[\[redirects\]\]|statusCode\s*:\s*301/i),
      weight: 10,
      details: "Detected common redirect config patterns",
    },
  ];

  const implemented = checks.filter((check) => check.implemented);
  const missing = checks.filter((check) => !check.implemented);
  const score = implemented.reduce((sum, check) => sum + check.weight, 0);
  const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
  const normalizedScore = Math.round((score / maxScore) * 100);
  const grade = gradeFromScore(normalizedScore);

  console.log("Sophon SEO audit");
  console.log(`Already in place: ${implemented.length}/${checks.length}`);

  for (const check of implemented) {
    console.log(`  ✓ ${check.label} (+${check.weight})`);
  }

  if (missing.length > 0) {
    console.log("\nRecommended next additions:");

    for (const check of missing) {
      console.log(`  ✗ ${check.label} (${check.weight} pts available)`);
      if (check.details) {
        console.log(`    hint: ${check.details}`);
      }
    }
  }

  console.log(`\nSEO score: ${score}/${maxScore} — ${normalizedScore}/100 (${grade})`);

  return { score, maxScore, grade, checks };
}
