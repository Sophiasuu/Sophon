---
name: technical
description: "Generate technical SEO assets: sitemap.xml (with sitemap index for large sites), robots.txt, per-entity schema markup (BreadcrumbList, AggregateRating), configurable internal link graph, and hreflang scaffold. Use when the user wants to add or update sitemap, robots, structured data, internal linking, or multilingual hreflang tags."
argument-hint: "[--site <url>] [--max-links <n>]"
---

Generate technical SEO scaffolds from discovered entities: sitemap, robots, schema, and internal links.

## MANDATORY PREPARATION

Invoke the `sophon` skill first. It contains entity model conventions, output path expectations, and the **Context Gathering Protocol**.

**Follow the protocol before doing any work:**
1. Check loaded instructions for a `## Sophon Project Context` section.
2. Check `.sophon.md` in the project root.
3. If neither exists, run `sophon teach` now — do NOT skip this step.

---

## Execution

```bash
npx @sophonn/sophon technical --site https://example.com

# Custom output root (default: public/)
npx @sophonn/sophon technical --site https://example.com --technical-output ./static

# Custom internal link count per entity (default: 5)
npx @sophonn/sophon technical --site https://example.com --max-links 8
```

## Outputs

| Asset | Default path |
|-------|-----------|
| Sitemap | `public/sitemap.xml` (auto-splits into sitemap index + child sitemaps for >45K URLs) |
| Robots | `public/robots.txt` |
| Schema records | `public/sophon/schema.json` |
| Breadcrumb schema | `public/sophon/breadcrumbs.json` |
| Internal link graph | `public/sophon/internal-links.json` |
| Hreflang scaffold | `public/sophon/hreflang.txt` |

Adjust the output root with `--technical-output`. Check the host project's conventions:

- Next.js, Remix, Astro → `public/`
- Nuxt → `public/`
- SvelteKit → `static/`

If the host project already owns sitemap or robots generation, **merge or adapt** — do not duplicate.

## What Gets Generated

**Sitemap**: One entry per entity with `lastmod` set from `enrichedAt` → `generatedAt` → today (in precedence order), `changefreq` and `priority` based on intent classification. Automatically generates a sitemap index with 45K-URL child sitemaps when entity count exceeds the threshold.

**Schema**: Type is inferred heuristically from entity tags (e.g., `SoftwareApplication`, `Product`, `WebPage`). Entities with `ratingValue` and `ratingCount` attributes get automatic `AggregateRating` markup. Not hard-coded to `Article`.

**Breadcrumbs**: BreadcrumbList schema per entity with Home → Entity path. Written to `public/sophon/breadcrumbs.json`.

**Internal links**: Entities are linked by shared seed keyword, tag overlap, intent affinity, and word overlap — not by array position. Configurable via `--max-links` (default 5).

**Hreflang scaffold**: Generates `public/sophon/hreflang.txt` with documented `<link rel="alternate" hreflang="...">` examples for every entity. Copy the relevant blocks into your page `<head>` when adding language or region variants. This is a scaffold — it does not auto-inject into pages.

**Robots**: Permissive default; customize based on host project requirements.

## Programmatic API

```ts
import { technical } from "@sophonn/sophon";

await technical({
  entities: result.entities,
  site: "https://example.com",
  output: "public",
  maxLinks: 8, // optional, default 5
});
```

## After Technical Generation

If AI content enrichment is needed, run the `enrich` skill. Otherwise, review the sitemap and schema outputs and integrate them into the host project's existing SEO pipeline if one exists.
