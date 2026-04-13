import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

type AuditOptions = {
  root?: string;
};

type CheckResult = {
  label: string;
  implemented: boolean;
  details?: string;
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

export async function audit(options: AuditOptions = {}): Promise<void> {
  const root = options.root ?? process.cwd();
  const files = await walkFiles(root);

  const checks: CheckResult[] = [
    {
      label: "Sitemap",
      implemented:
        (await exists(path.join(root, "public", "sitemap.xml"))) ||
        (await exists(path.join(root, "static", "sitemap.xml"))) ||
        (await exists(path.join(root, "sitemap.xml"))),
      details: "Expected one of: public/sitemap.xml, static/sitemap.xml, sitemap.xml",
    },
    {
      label: "Robots",
      implemented:
        (await exists(path.join(root, "public", "robots.txt"))) ||
        (await exists(path.join(root, "static", "robots.txt"))) ||
        (await exists(path.join(root, "robots.txt"))),
      details: "Expected one of: public/robots.txt, static/robots.txt, robots.txt",
    },
    {
      label: "Canonical tags",
      implemented: await hasPattern(files, /rel=["']canonical["']/i),
      details: "Detected by rel=\"canonical\" in page/head code",
    },
    {
      label: "Open Graph tags",
      implemented: await hasPattern(files, /og:title|openGraph/i),
      details: "Detected by og:* tags or openGraph metadata objects",
    },
    {
      label: "Twitter card tags",
      implemented: await hasPattern(files, /twitter:card|twitter\s*:\s*\{/i),
      details: "Detected by twitter:card tags or twitter metadata objects",
    },
    {
      label: "Structured data (JSON-LD)",
      implemented: await hasPattern(files, /application\/ld\+json|"@context"\s*:\s*"https:\/\/schema.org"/i),
      details: "Detected by JSON-LD script or schema.org context",
    },
    {
      label: "404 handling",
      implemented:
        (await exists(path.join(root, "app", "not-found.tsx"))) ||
        (await exists(path.join(root, "pages", "404.tsx"))) ||
        (await exists(path.join(root, "src", "routes", "+error.svelte"))),
      details: "Detected common framework 404 conventions",
    },
    {
      label: "Redirect handling",
      implemented: await hasPattern(files, /redirects\s*\(|\[\[redirects\]\]|statusCode\s*:\s*301/i),
      details: "Detected common redirect config patterns",
    },
  ];

  const implemented = checks.filter((check) => check.implemented);
  const missing = checks.filter((check) => !check.implemented);

  console.log("Sophon SEO audit");
  console.log(`Already in place: ${implemented.length}/${checks.length}`);

  for (const check of implemented) {
    console.log(`- already implemented: ${check.label}`);
  }

  if (missing.length > 0) {
    console.log("\nRecommended next additions:");

    for (const check of missing) {
      console.log(`- missing: ${check.label}`);
      if (check.details) {
        console.log(`  hint: ${check.details}`);
      }
    }
  }
}
