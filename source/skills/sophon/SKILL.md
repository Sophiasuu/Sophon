---
name: sophon
description: "Master context for Sophon — an agentic programmatic SEO toolkit. Teaches the framework, entity model, adapter system, and operating rules. Invoke this skill before using discover, generate, technical, enrich, optimize, or run so you have the full context. Call with 'teach' to run the onboarding interview and create .sophon.md."
argument-hint: "[teach]"
user-invocable: true
---

Sophon is an open-source programmatic SEO toolkit that turns a seed keyword or entity list into framework-specific pages, sitemaps, schema markup, internal linking data, and optional AI enrichment outputs.

## Context Gathering Protocol

Sophon produces generic, low-quality output without project context. Every skill MUST have confirmed project context before doing any work.

**Gathering order — follow exactly:**

1. **Check loaded instructions (instant):** If your instructions already contain a `## Sophon Project Context` section, proceed immediately.
2. **Check `.sophon.md` (fast):** Read `.sophon.md` from the project root. If it exists and contains the required fields, proceed.
3. **Run `sophon teach` (REQUIRED):** If neither source has context, run this skill with the `teach` argument NOW. Do NOT skip this. Do NOT attempt to infer context from the codebase — code tells you what exists, not what the user is trying to achieve.

**Required context fields:**

- **Niche / seed keyword** — What topic or market is this SEO surface targeting?
- **Framework** — Next.js, Astro, Nuxt, SvelteKit, or Remix
- **Site URL** — Base URL for sitemap and schema generation
- **Content goal** — What should each page accomplish? (rank for long-tail, capture leads, drive signups, etc.)
- **Entity source** — Seed keyword expansion, CSV import, or existing `data/entities.json`
- **AI enrichment** — Is `ANTHROPIC_API_KEY` available for content generation?

---

## teach

When invoked as `sophon teach`, run this onboarding interview. Ask these questions **one group at a time** — do not dump all questions at once.

### Group 1: Project basics

> I'll ask a few quick questions so Sophon can work properly with your project. Let's start with the basics.
>
> 1. **What is the niche or topic** you want to build a programmatic SEO surface for? (e.g. "best payroll software for small teams")
> 2. **What is your site's base URL?** (e.g. `https://mysite.com`)
> 3. **Which framework** does your project use? (Next.js, Astro, Nuxt, SvelteKit, Remix — or I can auto-detect)

### Group 2: Content strategy

> 4. **What is the goal of each generated page?** (e.g. rank for long-tail keywords, capture leads, drive free trial signups, build topical authority)
> 5. **Who is your target audience?** (e.g. HR managers at SMBs, freelance designers, e-commerce store owners)
> 6. **What makes your offering different** from what competitors rank for today?

### Group 3: Technical setup

> 7. **How will you source entities?** Choose one:
>    - Seed keyword expansion (Sophon scaffolds entities from your niche)
>    - CSV file (you provide a file with entity names and attributes)
>    - Existing `data/entities.json`
> 8. **Do you have an `ANTHROPIC_API_KEY`** for AI content enrichment? (yes / no / I'll add it later)

### After the interview

Write all answers into `.sophon.md` at the project root using this exact format:

```markdown
## Sophon Project Context

- **Niche**: [answer]
- **Site URL**: [answer]
- **Framework**: [answer]
- **Content goal**: [answer]
- **Target audience**: [answer]
- **Differentiator**: [answer]
- **Entity source**: [seed | csv | existing]
- **AI enrichment**: [yes | no | pending]
```

Then confirm:

> Context saved to `.sophon.md`. You're ready to run Sophon skills.
> Next step: use the `discover` skill to find entities, or `run` to execute the full pipeline.

---

## Core Concepts

### Entity Model

Every Sophon workflow starts with **entities** — normalized records that represent the subjects of generated pages.

```ts
type EntityRecord = {
  id: string;              // deterministic, source-agnostic slug hash
  name: string;            // display name
  slug: string;            // URL-safe identifier
  source: "csv" | "seed";
  seedKeyword?: string;    // originating niche when discovered from seed
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];       // used for internal linking scores
    attributes: Record<string, string>; // CSV columns or enrichment data
    ogImage?: string;      // OG image URL for social cards and hero images
    generatedAt?: string;  // ISO timestamp set during discovery for freshness tracking
    enrichedAt?: string;   // ISO timestamp set during enrichment, used for sitemap lastmod
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
| `generate` | `sophon generate` | Generate framework pages with JSON-LD schema and fallback content |
| `technical` | `sophon technical` | Sitemap (with index), robots, schema (BreadcrumbList, AggregateRating), FAQ schema, configurable internal links |
| `enrich` | `sophon enrich` | AI-powered content enrichment (concurrent, cached, retry, dry-run) |
| `optimize` | `sophon optimize` | GSC-powered performance analysis and recommendations |
| `blog` | `sophon blog` | Generate supporting blog outlines per entity |
| `keywords` | `sophon keywords` | Keyword difficulty and opportunity analysis with CSV data import |
| `quality` | `sophon quality` | Content quality scoring (readability, structure) |
| `humanize` | `sophon humanize` | Remove AI-isms and mechanical patterns from text |
| `run` | `sophon run` | Full pipeline |

## Operating Rules

1. **Inspect before editing.** Read the host project's structure before generating anything.
2. **Prefer additive changes.** Do not overwrite existing routes or application code.
3. **Keep outputs isolated.** Generated files go into predictable folders (`data/`, framework output root, `public/sophon/`).
4. **Preserve host conventions.** Align with the project's naming and folder patterns.
5. **Scaffold, never fabricate.** If AI content generation is not wired, insert `// TODO` blocks — do not invent placeholder text.
6. **Surface warnings.** Hallucination-prevention comments, YMYL warnings, and duplicate slug checks are built into generated output. Preserve them.

## Context Gathering

See the **Context Gathering Protocol** at the top of this skill. If `.sophon.md` does not exist, run `sophon teach` before proceeding with any other skill.
