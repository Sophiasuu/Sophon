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

1. **Discover 🔎** — normalize entities from a CSV or seed keyword into `data/entities.json`
2. **Propose 🧭** — generate intent-aware entity suggestions with priority, confidence, and action recommendations
3. **Generate 🧱** — scaffold one page per entity with **intent-specific sections**, OG/Twitter cards, canonical, and YMYL warnings baked in
4. **Technical 🛠️** — emit `sitemap.xml`, `robots.txt`, JSON-LD schema, internal link graph, and hreflang scaffold
5. **Enrich ✨** — use Claude to fill TODO sections with grounded, structured content
6. **Score 📊** — check entity health (metadata completeness, intent confidence, slug quality) with A-F grades
7. **Audit ✅** — scan existing SEO implementation and get a weighted score with letter grade

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
```

Outputs:

| File | Description |
|------|-------------|
| `sitemap.xml` | All entity URLs with `lastmod`, `changefreq`, `priority` |
| `robots.txt` | `Allow: *` + sitemap pointer |
| `public/sophon/schema.json` | JSON-LD per entity (`WebPage`, `LocalBusiness`, `Product`, `SoftwareApplication`) |
| `public/sophon/internal-links.json` | Related entity pairs scored by shared tags and seed keyword |
| `public/sophon/hreflang.txt` | `<link rel="alternate">` scaffold — wire into your framework manually |

### 6. Enrich with AI 🤖

```bash
npx @sophonn/sophon enrich
```

Requires `ANTHROPIC_API_KEY`. Calls Claude to generate structured content per entity: intro, sections, FAQs, comparisons. Uses TODO markers instead of invented content when data is missing. Writes one JSON file per entity to `data/enriched/`.

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

Checks 8 SEO implementations with weighted scoring:

| Check | Weight |
|-------|--------|
| Canonical tags | 20 |
| Sitemap | 15 |
| Open Graph tags | 15 |
| Structured data (JSON-LD) | 15 |
| Robots.txt | 10 |
| Twitter cards | 10 |
| Redirect handling | 10 |
| 404 handling | 5 |

Reports a normalized 0-100 score with letter grade (A/B/C/D/F).

### 9. Score entity health 📊

```bash
npx @sophonn/sophon score
```

Evaluates each entity across 7 checks (title, description, tags, attributes, slug quality, intent confidence, name specificity) and assigns a score out of 100 with a letter grade. Low-scoring entities are flagged for attention. Writes results to `data/scores.json`.

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
  classifyIntent,
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
});

await enrich({
  entities: result.entities,
  output: "data/enriched",
});

const auditResult = await audit();
// auditResult.score, auditResult.grade, auditResult.checks

const scores = scoreEntities(result.entities);
// scores.averageScore, scores.averageGrade, scores.entities

const intent = classifyIntent("best payroll software pricing");
// intent.intent → "commercial", intent.confidence → 0.9
```

## Agent Skills 🤖

Sophon ships a multi-provider agent skill system. Skills are defined once in `source/skills/` and distributed to:

- `.claude/` — Claude Code 💬
- `.agents/` — VS Code Copilot agent mode 🧭
- `.cursor/` — Cursor 🖱️
- `.codex/` — Codex CLI ⌨️

Six skills: `sophon` (master context + `teach`), `discover`, `generate`, `technical`, `enrich`, `run`.

All step skills enforce a preparation check: confirm instructions exist → check `.sophon.md` → run `sophon teach` if missing.

Typical prompt:

```text
Use Sophon to add a programmatic SEO surface to this Next.js app for the niche "best employee scheduling software". Discover entities, generate the route scaffold, and wire the technical SEO outputs into this codebase.
```

## Current Scope 📌

**What Sophon does ✅:**

- Entity ingestion from CSV or seed keyword
- Intent-aware entity proposal with priority and confidence scoring
- Multi-framework page scaffolding (Next.js, Astro, Nuxt 3, SvelteKit, Remix)
- **Intent-aware page layouts** — different TODO sections per intent (commercial, comparison, segmented, informational)
- OG + Twitter card meta tags on every generated page
- Canonical URL per page
- YMYL detection with editorial warnings
- Duplicate slug detection (skips with warning)
- `sitemap.xml` with `lastmod`, `changefreq`, `priority`
- `robots.txt` with sitemap pointer
- JSON-LD schema inference (`WebPage`, `LocalBusiness`, `Product`, `SoftwareApplication`)
- Internal link graph scored by shared tags and seed keyword
- Hreflang scaffold for multilingual setups
- AI content enrichment via Claude (no-hallucination prompt, TODO markers for missing data)
- **Weighted SEO audit** with 0-100 score and A-F grade
- **Entity health scoring** (metadata completeness, intent confidence, slug quality)
- Shared intent classification engine reusable via programmatic API
- `sophon teach` onboarding flow that writes project context to `.sophon.md`
- Multi-provider agent skill system (Claude, Cursor, Codex, VS Code)
- Output path traversal protection (all `--output` flags validated against cwd)
- XSS-safe template hydration (`<`/`>` escaped in entity values)
- 145 tests across 12 test files (vitest)

**What Sophon does not do ❌:**

- OG image generation or responsive image handling
- Actual hreflang implementation (scaffold only — wire it yourself)
- Multilingual content or i18n routing
- Live SERP scraping or real-time data fetching
- Keyword research (seed keywords are user-supplied)
- Deployment or CI integration
- Analytics or tracking tag injection
- Core Web Vitals or page speed optimization
- CMS sync (Contentful, Sanity, etc.)
- Content freshness management or scheduled re-enrichment
- A/B testing or variant generation

## What Is Not Part of This pSEO Yet (Coming Soon) ⏳

These capabilities are intentionally out of scope today and planned for upcoming versions:

- AI-assisted entity expansion and SERP-backed discovery providers
- OG image generation per entity
- First-class multilingual support (not just hreflang scaffold output)
- Pagination and faceted navigation handling helpers
- 404 and redirect helpers (including 301 mapping outputs)
- CMS connectors (Contentful, Sanity)
- Content freshness workflows and scheduled re-enrichment
- Performance-focused generation defaults for Core Web Vitals

## Design Principles 🧭

- Framework agnostic core, Next.js first output 🧩
- Minimal config to get started 🪶
- Agent-native workflow 🤖
- Built for scale across hundreds or thousands of pages 📈

## Roadmap 🛣️

1. Pluggable entity discovery providers (SERP APIs, AI expansion)
2. OG image generation per entity
3. Niche-aware schema presets replacing heuristic inference
4. Review and approval workflow before publishing
5. Content freshness management and scheduled re-enrichment (`sophon refresh`)
6. CMS connector (Contentful, Sanity)
7. Learning loop — GSC/GA4 data feedback for entity prioritization
8. A/B testing and variant generation per intent
