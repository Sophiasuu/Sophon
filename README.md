# Sophon

Sophon is an open source programmatic SEO toolkit for teams that want to generate SEO-ready pages inside an existing Next.js app without hand-authoring hundreds of routes.

It starts from a seed keyword or an entity list, discovers targets worth publishing, and scaffolds the technical SEO pieces needed to ship pages at scale:

- entity discovery
- per-entity Next.js App Router page generation
- sitemap and robots generation
- schema markup scaffolding
- internal linking data

The core is framework agnostic, but the first output target is Next.js.

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
├── data/
│   └── entities.json
├── scripts/
│   ├── discover.ts
│   ├── generate.ts
│   └── technical.ts
├── types.ts
└── templates/
    └── page.tsx
```

## Quickstart

### 1. Clone or copy Sophon into your project workspace

Sophon is designed to be integrated into an existing Next.js application using the App Router.

### 2. Ensure you can run TypeScript scripts

One simple option is to install `tsx`:

```bash
npm install -D tsx
```

Then run scripts with:

```bash
npx tsx scripts/discover.ts --seed "best payroll software"
npx tsx scripts/generate.ts --output ./app
npx tsx scripts/technical.ts --site https://example.com --output ./public
```

### 3. Discover entities

From a seed keyword:

```bash
npx tsx scripts/discover.ts --seed "best payroll software"
```

With custom expansion patterns:

```bash
npx tsx scripts/discover.ts \
	--seed "best payroll software" \
	--pattern "{seed} alternatives" \
	--pattern "{seed} pricing" \
	--pattern "best {seed}"
```

From a CSV file:

```bash
npx tsx scripts/discover.ts --csv ./input/entities.csv
```

This writes normalized entities into `data/entities.json`.

Notes:

- Repeated `--pattern` flags are preferred over `--patterns "a|b|c"` because they are less fragile in shells.
- Extra CSV columns are preserved in `metadata.attributes` so downstream generation can use them.
- Entity IDs are deterministic and source-agnostic, so the same normalized entity produces the same ID across CSV and seed discovery.
- Discovery still uses placeholder seed expansion today; provider-backed entity discovery remains the main unfinished capability.

### 4. Generate App Router pages

```bash
npx tsx scripts/generate.ts --output ./app
```

This generates one static page per entity at `app/[slug]/page.tsx`.

Each generated page includes:

- entity name and slug
- SEO title and description from metadata
- tags and attributes from discovery
- guardrail comments for grounded AI content
- explicit TODO sections for intro, FAQ, and comparison content

The generator also logs warnings for:

- YMYL-sensitive entities
- thin metadata payloads
- duplicate slugs

### 5. Generate technical SEO assets

```bash
npx tsx scripts/technical.ts --site https://example.com --output ./public
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

## Claude Code Native

Sophon ships with [AGENT.md](/workspaces/Sophon/AGENT.md), which gives Claude Code an explicit operating playbook so a user can clone this repository and ask Claude Code to run Sophon autonomously inside their own project.

Typical prompt:

```text
Use Sophon to add a programmatic SEO surface to this Next.js app for the niche "best employee scheduling software". Discover entities, generate the route scaffold, and wire the technical SEO outputs into this codebase.
```

## Current Scope

Included in this scaffold:

- entity ingestion via CSV
- seed-keyword based placeholder discovery
- per-entity static Next.js page generation
- technical SEO file generation scaffold
- shared types in `types.ts`
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
2. Add AI content generation adapters for intro, FAQ, comparison, and metadata sections.
3. Replace heuristic schema selection with niche-aware schema presets.
4. Add review and approval workflows before publishing.
5. Package Sophon as an installable CLI.