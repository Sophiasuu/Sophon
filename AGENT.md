# AGENT.md

Sophon is an open-source programmatic SEO toolkit. Use it to turn a seed keyword or entity list into framework-specific pages, sitemaps, schema markup, and AI-enriched content — with a single CLI command or via a programmatic API.

## Skills

Sophon ships a set of composable skills. Start with **sophon** to load the full context, then use the step skills:

| Skill | Purpose |
|-------|---------|
| `sophon` | Master context — entity model, adapter map, operating rules |
| `discover` | Find entities from a seed keyword or CSV |
| `generate` | Generate one static page per entity |
| `technical` | Produce sitemap, robots.txt, schema, and internal links |
| `enrich` | AI-powered content enrichment via Claude |
| `run` | Full pipeline in one command |

Skills live in `source/skills/` and are distributed to `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, and `.codex/skills/` by running:

```bash
npm run build:skills
```

## Quick Start

```bash
# Full pipeline in one command
npx @sophonn/sophon run \
  --seed "best payroll software" \
  --framework nextjs \
  --site https://example.com

# Step by step
npx @sophonn/sophon discover --seed "best payroll software"
npx @sophonn/sophon generate --framework nextjs
npx @sophonn/sophon technical --site https://example.com
```

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