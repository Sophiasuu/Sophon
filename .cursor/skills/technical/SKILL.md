---
name: technical
description: "Generate technical SEO assets: sitemap.xml, robots.txt, per-entity schema markup, internal link graph, and hreflang scaffold. Use when the user wants to add or update sitemap, robots, structured data, internal linking, or multilingual hreflang tags."
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
```

## Outputs

| Asset | Default path |
|-------|-------------|
| Sitemap | `public/sitemap.xml` |
| Robots | `public/robots.txt` |
| Schema records | `public/sophon/schema.json` |
| Internal link graph | `public/sophon/internal-links.json` |
| Hreflang scaffold | `public/sophon/hreflang.txt` |

Adjust the output root with `--technical-output`. Check the host project's conventions:

- Next.js, Remix, Astro → `public/`
- Nuxt → `public/`
- SvelteKit → `static/`

If the host project already owns sitemap or robots generation, **merge or adapt** — do not duplicate.

## What Gets Generated

**Sitemap**: One entry per entity with `lastmod` set to today's date, `changefreq: weekly`, and `priority: 0.7`.

**Schema**: Type is inferred heuristically from entity tags (e.g., `SoftwareApplication`, `Product`, `WebPage`). Not hard-coded to `Article`.

**Internal links**: Entities are linked by shared seed keyword and tags, not by array position. Up to 3 related entities per node.

**Hreflang scaffold**: Generates `public/sophon/hreflang.txt` with documented `<link rel="alternate" hreflang="...">` examples for every entity. Copy the relevant blocks into your page `<head>` when adding language or region variants. This is a scaffold — it does not auto-inject into pages.

**Robots**: Permissive default; customize based on host project requirements.

## Programmatic API

```ts
import { technical } from "@sophonn/sophon";

await technical({
  entities: result.entities,
  site: "https://example.com",
  output: "public",
});
```

## After Technical Generation

If AI content enrichment is needed, run the `enrich` skill. Otherwise, review the sitemap and schema outputs and integrate them into the host project's existing SEO pipeline if one exists.
