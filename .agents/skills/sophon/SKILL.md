---
name: sophon
description: "Master context for Sophon — an agentic programmatic SEO toolkit. Teaches the framework, entity model, adapter system, and operating rules. Invoke this skill before using discover, generate, technical, enrich, or run so you have the full context."
user-invocable: true
argument-hint: "[teach]"
---

Sophon is an open-source programmatic SEO toolkit that turns a seed keyword or entity list into framework-specific pages, sitemaps, schema markup, internal linking data, and optional AI enrichment outputs.

## Core Concepts

### Entity Model

Every Sophon workflow starts with **entities** — normalized records that represent the subjects of generated pages.

```ts
type Entity = {
  id: string;          // deterministic, source-agnostic slug hash
  name: string;        // display name
  slug: string;        // URL-safe identifier
  seed: string;        // originating keyword or niche
  tags: string[];      // topic tags used for internal linking
  seoTitle: string;
  metaDescription: string;
  metadata: {
    attributes: Record<string, string>; // CSV columns or enrichment data
  };
};
```

Entity IDs are **deterministic** — the same normalized entity produces the same ID whether it comes from a CSV or seed discovery. This makes discovery outputs composable and re-runnable without duplication.

### Adapters

Sophon generates framework-specific static pages via adapters:

| Framework | Output path |
|-----------|-------------|
| Next.js | `app/[slug]/page.tsx` |
| Astro | `src/pages/[slug].astro` |
| Nuxt 3 | `pages/[slug].vue` |
| SvelteKit | `src/routes/[slug]/+page.svelte` + `+page.ts` |
| Remix | `app/routes/[slug].tsx` |

For SvelteKit, **always generate both files**: `+page.svelte` contains the component; `+page.ts` contains the prerenderable entity payload.

### Workflow Skills

Sophon breaks its workflow into composable skills. Each step corresponds to a CLI command and a programmatic API:

| Skill | CLI | Purpose |
|-------|-----|---------|
| `discover` | `sophon discover` | Find entities from seed or CSV |
| `generate` | `sophon generate` | Generate framework pages |
| `technical` | `sophon technical` | Sitemap, robots, schema, links |
| `enrich` | `sophon enrich` | AI-powered content enrichment |
| `run` | `sophon run` | Full pipeline |

## Operating Rules

1. **Inspect before editing.** Read the host project's structure before generating anything.
2. **Prefer additive changes.** Do not overwrite existing routes or application code.
3. **Keep outputs isolated.** Generated files go into predictable folders (`data/`, framework output root, `public/sophon/`).
4. **Preserve host conventions.** Align with the project's naming and folder patterns.
5. **Scaffold, never fabricate.** If AI content generation is not wired, insert `// TODO` blocks — do not invent placeholder text.
6. **Surface warnings.** Hallucination-prevention comments, YMYL warnings, and duplicate slug checks are built into generated output. Preserve them.

## Context Gathering

Before running any Sophon skill, confirm:

- **Framework**: Next.js, Astro, Nuxt, SvelteKit, or Remix (auto-detect from `package.json`)
- **Input**: seed keyword, CSV path, or existing `data/entities.json`
- **Site URL**: needed for technical SEO assets

If the user provides both a seed and a CSV, treat the CSV as source of truth and the seed as enrichment context.
