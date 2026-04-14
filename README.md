# Sophon

Sophon is an open-source programmatic SEO toolkit. It turns a seed keyword or entity list into framework-specific landing pages, sitemaps, schema markup, OG/Twitter cards, internal linking data, and optional AI-enriched content.

Install from npm:

```bash
npm install @sophonn/sophon
```

Framework adapters:

| Framework | Output |
|-----------|--------|
| Next.js | `app/[slug]/page.tsx` |
| Astro | `src/pages/[slug].astro` |
| Nuxt 3 | `pages/[slug].vue` |
| SvelteKit | `src/routes/[slug]/+page.svelte` + `+page.ts` |
| Remix | `app/routes/[slug].tsx` |

## Who This Is For

### Indie hackers 🚀

Go from a niche keyword to dozens of long-tail landing pages without building a custom pipeline from scratch.

### Agencies 🤝

Standardize pSEO execution across client projects with a repeatable discovery-to-publish workflow.

### Enterprise teams 🏢

Use Sophon as a controlled scaffolding layer for large SEO surfaces, while keeping routing, data, and review workflows inside your existing codebase.

## Core Workflow ⚙️

1. **Discover 🔎** — normalize entities from a CSV or seed keyword into `data/entities.json`, with `generatedAt` timestamps for freshness tracking
2. **Propose 🧭** — generate intent-aware entity suggestions with priority, confidence, and action recommendations
3. **Generate 🧱** — scaffold one page per entity with **intent-specific sections**, OG/Twitter cards, hero images, canonical, fallback content from metadata, and YMYL warnings baked in
4. **Technical 🛠️** — emit `sitemap.xml` (with automatic sitemap index for >45K URLs), `robots.txt`, JSON-LD schema (with AggregateRating and BreadcrumbList), configurable internal link graph, and hreflang scaffold
5. **Enrich ✨** — use Claude to fill TODO sections with grounded, structured content — with exponential backoff retry and `--dry-run` mode
6. **Keywords 🔑** — keyword difficulty and opportunity analysis with optional real data import from CSV (Ahrefs, SEMrush, Google Keyword Planner)
7. **Score 📊** — check entity health (metadata completeness, intent confidence, slug quality) with A-F grades
8. **Audit ✅** — scan existing SEO implementation across 12 weighted checks (including JSON-LD validity, duplicate meta detection, heading hierarchy, and image alt text)
9. **Optimize 🚀** — pull real GSC performance data, detect underperforming pages, and generate prioritized recommendations
10. **Diff 🔄** — preview what pages would change before regenerating (new/updated/unchanged/removed)
11. **Stale 📅** — list entities older than N days for content freshness management

## Repository Structure 📁

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
├── tests/
├── source/skills/
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Quickstart ⚡

### 1. Install 📦

```bash
npm install @sophonn/sophon
```

### 2. Run the onboarding interview 🧠

Ask your AI agent to run `sophon teach`. It will walk through three groups of questions — project basics, content strategy, technical setup — and save answers to `.sophon.md`. Every skill references this file before running.

### 3. Discover entities 🔍

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

Writes normalized entities to `data/entities.json` by default. Extra CSV columns are preserved in `metadata.attributes` for downstream use.

### 3.5 Propose entities (review-first) 🧭

```bash
npx @sophonn/sophon propose --seed "best payroll software"
```

This generates `data/proposed-entities.json` with intent-aware proposed entities (commercial, comparison, segmented, informational), plus priority, confidence, and recommended action (`keep` or `review`).

Use `--limit` to cap the list size and `--propose-output` to customize output path.

### 4. Generate pages 🧩

```bash
npx @sophonn/sophon generate --framework nextjs
```

One file per entity. Duplicate slugs are skipped with a warning. Pages with YMYL keywords (health, legal, financial) get editorial warnings. Thin pages are flagged as TODOs.

**Intent-aware page layouts** 🧠 — Sophon detects entity intent from its name and generates different TODO section scaffolds:

| Intent | Detected by | Sections generated |
|--------|-------------|-------------------|
| Commercial | pricing, cost, plans, buy | Pricing Overview → Key Features → Who Is This For? → Get Started |
| Comparison | alternatives, vs, compare | Side-by-Side Comparison → Pros & Cons → Best For → Verdict |
| Segmented | for startups, for agencies | Pain Points → Tailored Use Cases → Success Stories → Next Steps |
| Informational | what is, how to, guide | What You Need to Know → Step-by-Step Guide → FAQ → Related Resources |

All pages include:

- OG and Twitter card meta tags 🏷️
- Canonical URL 🔗
- Generated comment block reminding editors not to invent facts 📝

### 5. Generate technical SEO assets 🗺️

```bash
npx @sophonn/sophon technical --site https://example.com

# With configurable internal link count
npx @sophonn/sophon technical --site https://example.com --max-links 8
```

Outputs:

| File | Description |
|------|-------------|
| `sitemap.xml` | All entity URLs with `lastmod` (from `enrichedAt`/`generatedAt`), `changefreq`, `priority` — auto-splits into sitemap index for >45K URLs |
| `robots.txt` | `Allow: *` + sitemap pointer |
| `public/sophon/schema.json` | JSON-LD per entity (`WebPage`, `LocalBusiness`, `Product`, `SoftwareApplication`) with optional `AggregateRating` |
| `public/sophon/breadcrumbs.json` | BreadcrumbList schema per entity (Home → Entity) |
| `public/sophon/internal-links.json` | Related entity pairs scored by shared tags and intent affinity (configurable limit via `--max-links`, default 5) |
| `public/sophon/hreflang.txt` | `<link rel="alternate">` scaffold — wire into your framework manually |

### 6. Enrich with AI 🤖

```bash
npx @sophonn/sophon enrich

# Preview prompts without calling the API
npx @sophonn/sophon enrich --dry-run
```

Requires `ANTHROPIC_API_KEY` (unless using `--dry-run`). Calls Claude to generate structured content per entity: intro, sections, FAQs, comparisons. Uses TODO markers instead of invented content when data is missing. Writes one JSON file per entity to `data/enriched/`.

Features:
- **Exponential backoff retry** — automatically retries on 429/500/502/503/529 errors (configurable via `--max-retries`, default 3)
- **Dry-run mode** — outputs the system and user prompts without calling the API, useful for reviewing what would be sent
- **Enrichment timestamp** — sets `enrichedAt` on each entity for downstream freshness tracking in sitemaps
- **Cache-aware** — skips already-enriched entities unless `--force` is passed

### 7. Run the full pipeline 🏁

```bash
npx @sophonn/sophon run --seed "best payroll software" --framework nextjs --site https://example.com
```

Per-step output overrides:

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

### 8. Audit existing SEO setup ✅

```bash
npx @sophonn/sophon audit
```

Checks 12 SEO implementations with weighted scoring:

| Check | Weight |
|-------|--------|
| Canonical tags | 20 |
| Sitemap | 15 |
| Open Graph tags | 15 |
| Structured data (JSON-LD) | 10 |
| JSON-LD schema validity | 5 |
| Unique titles and descriptions | 10 |
| Robots.txt | 10 |
| Twitter cards | 10 |
| Redirect handling | 10 |
| Heading hierarchy | 5 |
| Image alt text | 5 |
| 404 handling | 5 |

New deep validation checks:
- **JSON-LD validity** — verifies `@context`, `@type`, and `name` fields are present
- **Duplicate meta** — detects identical `<title>` and `<meta description>` across files
- **Heading hierarchy** — checks for H1 presence and no level skips (e.g. H1→H3)
- **Image alt text** — counts `<img>` tags missing `alt` attributes

Reports a normalized 0-100 score with letter grade (A/B/C/D/F).

### 9. Score entity health 📊

```bash
npx @sophonn/sophon score
```

Evaluates each entity across 7 checks (title, description, tags, attributes, slug quality, intent confidence, name specificity) and assigns a score out of 100 with a letter grade. Low-scoring entities are flagged for attention. Writes results to `data/scores.json`.

### 10. Optimize with GSC data 🚀

```bash
npx @sophonn/sophon optimize --site https://example.com
```

Pulls real performance data from Google Search Console, maps it to your Sophon entities, and generates a prioritized optimization report.

| Flag | Description |
|------|-------------|
| `--site` | **(required)** GSC property URL |
| `--limit` | Max pages to fetch (default: 500) |
| `--auto-fix` | Apply safe auto-fixes to enriched content |
| `--access-token` | GSC OAuth token (or set `GSC_ACCESS_TOKEN`) |
| `--output` | Report path (default: `data/optimization-report.json`) |

Detects issues:

| Pattern | Issue |
|---------|-------|
| High impressions + low CTR | Weak title/meta description |
| Position 8–20 | Striking distance — needs content depth |
| Position >20 | Poor ranking — significant content gap |
| Low impressions | Keyword mismatch or not indexed |

Each entity gets an optimization score (0–100) and priority level (critical/high/medium/low). Recommendations are typed as `meta`, `content`, `structure`, or `linking` with actionable steps and reasoning.

With `--auto-fix`, Sophon inserts `[OPTIMIZE]` TODO markers into enriched content files — it never overwrites existing content or modifies non-Sophon files.

Writes results to `data/optimization-report.json`.

### 11. Keyword analysis with real data 🔑

```bash
npx @sophonn/sophon keywords

# Import real keyword data from CSV
npx @sophonn/sophon keywords --keyword-data ./ahrefs-export.csv
```

When `--keyword-data` is provided, Sophon imports real keyword metrics from CSV exports. Supports flexible column detection for Ahrefs, SEMrush, and Google Keyword Planner formats:

| Column aliases detected | Data used |
|------------------------|----------|
| keyword, query, search term, keyphrase | Keyword name |
| volume, search volume, avg monthly searches | Monthly volume |
| difficulty, kd, keyword difficulty, competition | Difficulty score |
| cpc, cost per click, avg cpc | CPC estimate |

Imported data overrides heuristic estimates and is tagged with `dataSource: "imported"` in the output.

### 12. Preview changes before regenerating 🔄

```bash
npx @sophonn/sophon diff --framework nextjs
```

Compares current generated files against what would be produced. Reports:
- **New** — entities with no existing page file
- **Updated** — Sophon-managed files whose content would change
- **Unchanged** — files matching current generation output
- **Removed** — orphaned Sophon-managed files whose entities were deleted

Non-Sophon files (without the `SOPHON GENERATED` marker) are never flagged as removable.

### 13. Content freshness management 📅

```bash
npx @sophonn/sophon stale --days 90
```

Lists entities whose `generatedAt` or `enrichedAt` timestamp is older than the specified number of days. Useful for scheduling re-enrichment cycles and keeping content fresh.

### Safeproof behavior (skip if already implemented) 🛡️

Generation and technical commands now skip existing non-Sophon files by default and print a reminder that something is already in place.

Use `--force` only when you intentionally want to overwrite:

```bash
npx @sophonn/sophon generate --framework nextjs --force
npx @sophonn/sophon technical --site https://example.com --force
```

## Programmatic API 🧪

```ts
import {
  discover,
  propose,
  generate,
  technical,
  enrich,
  audit,
  scoreEntities,
  optimize,
  classifyIntent,
  buildSitemapIndex,
  buildBreadcrumbSchema,
  importKeywordData,
  diffGenerate,
} from "@sophonn/sophon";

const proposed = propose({ seed: "best payroll software", limit: 30 });

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
  maxLinks: 8, // configurable internal link count
});

await enrich({
  entities: result.entities,
  output: "data/enriched",
  dryRun: false,     // set true to preview prompts without API calls
  maxRetries: 3,     // exponential backoff retry count
});

// Import real keyword data from CSV
const keywordData = await importKeywordData("./ahrefs-export.csv");
const keywords = analyzeKeywords(result.entities, keywordData);

// Preview what would change before regenerating
const diff = await diffGenerate({
  entities: result.entities,
  framework: "nextjs",
});
// diff.newPages, diff.updatedPages, diff.removedPages

const auditResult = await audit();
// auditResult.score, auditResult.grade, auditResult.checks (12 checks)

const scores = scoreEntities(result.entities);
// scores.averageScore, scores.averageGrade, scores.entities

const intent = classifyIntent("best payroll software pricing");
// intent.intent → "commercial", intent.confidence → 0.9

const report = await optimize({
  site: "https://example.com",
  entities: result.entities,
});
// report.summary, report.entities[0].recommendations
```

## Agent Skills 🤖

Sophon ships a multi-provider agent skill system. Skills are defined once in `source/skills/` and distributed to:

- `.claude/` — Claude Code 💬
- `.agents/` — VS Code Copilot agent mode 🧭
- `.cursor/` — Cursor 🖱️
- `.codex/` — Codex CLI ⌨️

Six skills: `sophon` (master context + `teach`), `discover`, `generate`, `technical`, `enrich`, `run`.

**Plus** the `optimize` skill for GSC-powered performance analysis and recommendations.

Typical prompt:

```text
Use Sophon to add a programmatic SEO surface to this Next.js app for the niche "best employee scheduling software". Discover entities, generate the route scaffold, and wire the technical SEO outputs into this codebase.
```

## Current Scope 📌

**What Sophon does ✅:**

- Entity ingestion from CSV or seed keyword with `generatedAt` timestamps
- Intent-aware entity proposal with priority and confidence scoring
- Multi-framework page scaffolding (Next.js, Astro, Nuxt 3, SvelteKit, Remix)
- **Intent-aware page layouts** — different TODO sections per intent (commercial, comparison, segmented, informational)
- **Template-based fallback content** — metadata-derived content (attributes table, tags list) when no enrichment is available
- OG + Twitter card meta tags on every generated page
- **OG image support** (`og:image`, `twitter:image`) with conditional hero images and lazy loading across all adapters
- Canonical URL per page
- YMYL detection with editorial warnings
- Duplicate slug detection (skips with warning)
- `sitemap.xml` with `lastmod` (from `enrichedAt`/`generatedAt`), `changefreq`, `priority`
- **Sitemap index** — automatic chunking into 45K-URL child sitemaps with a sitemap index for large entity sets
- `robots.txt` with sitemap pointer
- JSON-LD schema inference (`WebPage`, `LocalBusiness`, `Product`, `SoftwareApplication`)
- **BreadcrumbList** schema per entity (Home → Entity)
- **AggregateRating** schema support for entities with `ratingValue`/`ratingCount` attributes
- Internal link graph scored by shared tags, intent affinity, and word overlap — **configurable limit** via `--max-links` (default 5)
- Hreflang scaffold for multilingual setups
- AI content enrichment via Claude (no-hallucination prompt, TODO markers for missing data)
- **Enrichment retry** — exponential backoff for 429/500/502/503/529 errors
- **Dry-run mode** — preview enrichment prompts without calling the API
- **Real keyword data import** — CSV import from Ahrefs, SEMrush, Google Keyword Planner with flexible column detection
- **Deep SEO audit** with 12 weighted checks (0-100 score, A-F grade) including JSON-LD validity, duplicate meta detection, heading hierarchy, and image alt text
- **Entity health scoring** (metadata completeness, intent confidence, slug quality)
- **GSC-powered optimization** — fetch real performance data, detect underperformance, generate typed recommendations
- **Auto-fix system** — safely insert optimization TODOs into enriched content
- **Content freshness tracking** — `generatedAt`/`enrichedAt` timestamps + `sophon stale` command
- **Diff command** — preview new/updated/unchanged/removed pages before regenerating
- Shared intent classification engine reusable via programmatic API
- `sophon teach` onboarding flow that writes project context to `.sophon.md`
- Multi-provider agent skill system (Claude, Cursor, Codex, VS Code)
- Output path traversal protection (all `--output` flags validated against cwd)
- XSS-safe template hydration (`<`/`>` escaped in entity values)
- 302 tests across 18 test files (vitest)

**What Sophon does not do ❌:**

- OG image generation (supports user-provided `ogImage` URLs, but does not generate images)
- Actual hreflang implementation (scaffold only — wire it yourself)
- Multilingual content or i18n routing
- Live SERP scraping or real-time data fetching
- Deployment or CI integration
- Analytics or tracking tag injection
- Core Web Vitals or page speed optimization
- Google Analytics integration (bounce rate, session time) — planned
- CMS sync (Contentful, Sanity, etc.)
- A/B testing or variant generation

## What Is Not Part of This pSEO Yet (Coming Soon) ⏳

These capabilities are intentionally out of scope today and planned for upcoming versions:

- AI-assisted entity expansion and SERP-backed discovery providers
- OG image generation per entity (currently supports user-provided URLs)
- First-class multilingual support (not just hreflang scaffold output)
- Pagination and faceted navigation handling helpers
- 404 and redirect helpers (including 301 mapping outputs)
- CMS connectors (Contentful, Sanity)
- Performance-focused generation defaults for Core Web Vitals

## Design Principles 🧭

- Framework agnostic core, Next.js first output 🧩
- Minimal config to get started 🪶
- Agent-native workflow 🤖
- Built for scale across hundreds or thousands of pages 📈

## Roadmap 🛣️

1. Pluggable entity discovery providers (SERP APIs, AI expansion)
2. OG image generation per entity (currently supports user-provided URLs)
3. Niche-aware schema presets replacing heuristic inference
4. Review and approval workflow before publishing
5. Scheduled re-enrichment automation (`sophon refresh --cron`)
6. CMS connector (Contentful, Sanity)
7. Learning loop — GSC/GA4 data feedback for entity prioritization
8. A/B testing and variant generation per intent
