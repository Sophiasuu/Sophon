import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { AuditCheck, AuditResult } from "../types";

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

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export async function audit(options: AuditOptions = {}): Promise<AuditResult> {
  const root = options.root ?? process.cwd();
  const files = await walkFiles(root);

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
      weight: 15,
      details: "Detected by JSON-LD script or schema.org context",
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
