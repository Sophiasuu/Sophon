# AGENT.md

Sophon is an open-source programmatic SEO toolkit. Use it to turn a seed keyword or entity list into framework-specific pages, sitemaps, schema markup, and AI-enriched content — with a single CLI command or via a programmatic API.

## Skills

Sophon ships a set of composable skills. Start with **sophon** to load the full context, then use the step skills:

| Skill | Purpose |
|-------|---------|
| `sophon` | Master context — entity model, adapter map, operating rules |
| `discover` | Find entities from a seed keyword or CSV |
| `generate` | Generate one static page per entity with JSON-LD schema and fallback content |
| `technical` | Sitemap (with index), robots.txt, schema (BreadcrumbList, AggregateRating), FAQ schema, configurable internal links |
| `enrich` | AI-powered content enrichment via Claude (concurrent, cached, retry, dry-run) |
| `optimize` | GSC-powered performance analysis and optimization |
| `blog` | Generate supporting blog outlines per entity |
| `keywords` | Keyword difficulty and opportunity analysis with CSV data import |
| `quality` | Content quality scoring (readability, structure) |
| `humanize` | Remove AI-isms and mechanical patterns from text |
| `run` | Full pipeline in one command |

Skills live in `source/skills/` and are distributed to `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, and `.codex/skills/` by running:

```bash
npm run build:skills
```

## Commands

| Command | Description |
|---------|-------------|
| `sophon init` | Create `sophon.config.json` with framework auto-detection |
| `sophon teach` | Interactive onboarding — writes project context to `.sophon.md` |
| `sophon discover` | Normalize entities from a seed keyword or CSV |
| `sophon propose` | Generate intent-aware entity suggestions with priority and confidence |
| `sophon generate` | Scaffold one page per entity for the target framework |
| `sophon technical` | Emit sitemap (with index), robots.txt, JSON-LD (BreadcrumbList, AggregateRating), internal links, hreflang |
| `sophon enrich` | AI content enrichment via Claude (requires `ANTHROPIC_API_KEY`, supports `--dry-run`) |
| `sophon run` | Full pipeline: discover → generate → technical → enrich |
| `sophon audit` | Scan existing SEO implementation, 12 weighted checks, 0-100 score |
| `sophon score` | Entity health scoring (metadata, intent, slug quality) |
| `sophon optimize` | GSC performance analysis with actionable recommendations |
| `sophon blog` | Generate supporting blog outlines per entity |
| `sophon keywords` | Keyword difficulty and opportunity analysis (supports `--keyword-data` CSV import) |
| `sophon quality` | Content quality scoring (readability, heading structure) |
| `sophon humanize` | Remove AI-isms from text content |
| `sophon diff` | Preview what pages would change before regenerating (new/updated/removed) |
| `sophon stale` | List entities older than N days for freshness management |

## Quick Start

```bash
# Full pipeline in one command
npx @sophonn/sophon run \
  --seed "best payroll software" \
  --framework nextjs \
  --site https://example.com

# Step by step
npx @sophonn/sophon teach
npx @sophonn/sophon discover --seed "best payroll software"
npx @sophonn/sophon propose --seed "best payroll software"
npx @sophonn/sophon generate --framework nextjs
npx @sophonn/sophon technical --site https://example.com
npx @sophonn/sophon audit
npx @sophonn/sophon score
npx @sophonn/sophon optimize --site https://example.com
npx @sophonn/sophon blog
npx @sophonn/sophon keywords
npx @sophonn/sophon keywords --keyword-data ./ahrefs-export.csv
npx @sophonn/sophon quality
npx @sophonn/sophon diff --framework nextjs
npx @sophonn/sophon stale --days 90
```

## Security

- All `--output` flags are validated against `process.cwd()` to prevent path traversal
- Entity values are XSS-escaped during template hydration (`<`/`>` → Unicode escapes)
- Template hydration uses single-pass regex replacement, not chained string substitution

## Testing

302 tests across 18 test files. Run with:

```bash
npm test
```

Covers: utils, discover, intent, propose, score, sections, technical, generate, enrich, audit, teach, optimize, humanize, quality, keywords, blog, diff, and all 5 framework adapters.

## Example User Prompts

```text
Use Sophon to build a pSEO surface for "best time tracking software" in this project and detect the right framework automatically.
```

```text
Use Sophon with ./input/saas-entities.csv and generate pages plus sitemap output for https://example.com.
```

```text
Integrate Sophon into this existing SvelteKit app, generate both +page.svelte and +page.ts files for each entity, and preserve the current route structure.
```