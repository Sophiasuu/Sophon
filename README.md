# Sophon

Sophon is an open source programmatic SEO toolkit packaged as an npm library with both a CLI and programmatic API. It turns a seed keyword or entity list into framework-specific pages, sitemaps, schema markup, internal linking data, and optional AI enrichment outputs.

The package is prepared to publish as `@sophonn/sophon` while keeping the CLI command name `sophon`.

It is framework agnostic in its core logic and currently ships generation adapters for:

- Next.js
- Astro
- Nuxt 3
- SvelteKit
- Remix

## Who This Is For

### Indie hackers

Use Sophon to go from a niche keyword to dozens or hundreds of long-tail landing pages without building a custom content pipeline from scratch.

### Agencies

Standardize pSEO execution across client projects with a repeatable discovery and generation workflow.

### Enterprise teams

Use Sophon as a controlled scaffolding layer for large SEO surfaces, while keeping routing, data, and review workflows inside your existing Next.js codebase.

## Core Workflow

1. Discover entities from either a CSV file or a seed keyword.
2. Persist those entities to `data/entities.json`.
3. Generate static entity routes for the Next.js App Router at `app/[slug]/page.tsx`.
4. Generate technical SEO assets such as `sitemap.xml`, `robots.txt`, schema records, and internal link graphs.
5. Replace the scaffolded TODO sections with your AI content generation provider and domain-specific enrichment logic.

## Repository Structure

```text
.
├── AGENT.md
├── README.md
├── src/
│   ├── adapters/
│   ├── cli.ts
│   ├── core/
│   ├── index.ts
│   └── types.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Quickstart

### 1. Install dependencies

```bash
npm install
```

To use the published package in another project:

```bash
npm install @sophonn/sophon
```

### 2. Build the package

```bash
npm run build
```

### 3. Initialize Sophon in a host project

```bash
npx @sophonn/sophon init --framework nextjs
```

This creates `sophon.config.json` with detected or specified framework defaults.

### 4. Discover entities

From a seed keyword:

```bash
npx @sophonn/sophon discover --seed "best payroll software"
```

With custom expansion patterns:

```bash
npx @sophonn/sophon discover \
	--seed "best payroll software" \
	--pattern "{seed} alternatives" \
	--pattern "{seed} pricing" \
	--pattern "best {seed}"
```

From a CSV file:

```bash
npx @sophonn/sophon discover --csv ./input/entities.csv
```

This writes normalized entities into `data/entities.json` by default, or to `--discover-output` when provided.

### 5. Generate pages

```bash
npx @sophonn/sophon generate --framework nextjs
```

Sophon generates one static page per entity. Output roots by framework default to:

- `nextjs` -> `app/[slug]/page.tsx`
- `astro` -> `src/pages/[slug].astro`
- `nuxt` -> `pages/[slug].vue`
- `sveltekit` -> `src/routes/[slug]/+page.svelte` and `src/routes/[slug]/+page.ts`
- `remix` -> `app/routes/[slug].tsx`

Notes:

- Repeated `--pattern` flags are preferred over `--patterns "a|b|c"` because they are less fragile in shells.
- Extra CSV columns are preserved in `metadata.attributes` so downstream generation can use them.
- Entity IDs are deterministic and source-agnostic, so the same normalized entity produces the same ID across CSV and seed discovery.
- Discovery still uses placeholder seed expansion today; provider-backed entity discovery remains the main unfinished capability.
- For SvelteKit, the companion `+page.ts` file contains the prerenderable entity payload that feeds the generated `+page.svelte` component.

### 6. Generate technical SEO assets

```bash
npx @sophonn/sophon technical --site https://example.com
```

This produces scaffolds for:

- `sitemap.xml`
- `robots.txt`
- `public/sophon/schema.json`
- `public/sophon/internal-links.json`

The technical generator now also:

- adds `lastmod` to sitemap entries
- infers a schema type heuristically instead of always using `Article`
- links entities by shared seed keyword and tags rather than array position
- logs a concrete output summary for every run

### 7. Run the full pipeline

```bash
npx @sophonn/sophon run --seed "best payroll software" --framework nextjs --site https://example.com
```

Per-step output overrides are supported for the full pipeline:

```bash
npx @sophonn/sophon run \
	--seed "best payroll software" \
	--framework sveltekit \
	--site https://example.com \
	--discover-output ./data/payroll-entities.json \
	--generate-output ./src/routes \
	--technical-output ./static \
	--enrich-output ./data/enriched
```

`--output` still works for single-command flows, but `run` should prefer step-specific flags so discovery, generation, technical assets, and enrichment can land in different locations.

## Programmatic API

Sophon also exposes a library API:

```ts
import { discover, generate, technical, enrich } from "@sophonn/sophon";

const result = await discover({ seed: "best payroll software" });

await generate({
	entities: result.entities,
	framework: "nextjs",
	output: "app",
});

await technical({
	entities: result.entities,
	site: "https://example.com",
	output: "public",
});

await enrich({
	entities: result.entities,
	output: "data/enriched",
});
```

## Claude Code Native

Sophon ships with [AGENT.md](/workspaces/Sophon/AGENT.md), which gives Claude Code an explicit operating playbook so a user can clone this repository and ask Claude Code to run Sophon autonomously inside their own project.

Typical prompt:

```text
Use Sophon to add a programmatic SEO surface to this Next.js app for the niche "best employee scheduling software". Discover entities, generate the route scaffold, and wire the technical SEO outputs into this codebase.
```

## Publishing

When you are ready to publish:

```bash
npm pack --dry-run
npm run build
npm publish --access public
```

If you want to verify the package contents first:

```bash
npm pack --dry-run
```

Recommended prepublish checklist:

- confirm you are logged into the npm account that owns the `@sophiasuu` scope
- confirm `npm run typecheck` passes
- confirm `npm run build` passes
- inspect the `npm pack --dry-run` file list
- confirm `ANTHROPIC_API_KEY` is not required for install or basic CLI usage
- confirm the MIT license in `LICENSE` matches how you want downstream users to consume the package

## Current Scope

Included in this scaffold:

- entity ingestion via CSV
- seed-keyword based placeholder discovery
- multi-framework page generation via CLI and API
- technical SEO asset generation
- shared types in `src/types.ts`
- AI enrichment entrypoint via the Anthropic SDK
- clear TODO markers for AI content generation and external data enrichment

Not implemented yet:

- live SERP scraping
- AI-assisted entity expansion
- automatic semantic clustering
- provider adapters for LLMs and search APIs
- CMS sync or publishing workflows

## Design Principles

- Framework agnostic core, Next.js first output
- Minimal config to get started
- Claude Code native workflow
- Built for scale across hundreds or thousands of pages

## Roadmap

1. Add pluggable entity discovery providers.
2. Improve enrichment prompt orchestration and structured output validation.
3. Replace heuristic schema selection with niche-aware schema presets.
4. Add review and approval workflows before publishing.
5. Package Sophon as an installable CLI.