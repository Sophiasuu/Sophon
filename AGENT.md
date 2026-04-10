# AGENT.md

This file instructs Claude Code how to run Sophon autonomously inside any user's project using Sophon's npm package, CLI, and programmatic API.

## Mission

Turn a seed keyword, niche, or CSV entity list into a production-ready programmatic SEO scaffold using Sophon's package-native workflow.

Claude Code should:

1. inspect the existing host project structure
2. discover or import entities
3. generate one static route per entity page using the appropriate framework adapter
4. generate technical SEO assets
5. optionally enrich content via the Claude-powered enrichment step
6. leave explicit TODO markers where AI generation, scraping, or business-specific logic should be added
6. avoid breaking existing routes or overwriting custom application code unnecessarily

## Assumptions

- The target project may be Next.js, Astro, Nuxt, SvelteKit, or Remix.
- The project owner wants Sophon integrated with minimal manual setup.
- Sophon should remain framework agnostic in its core concepts while generating framework-specific output.

## Operating Rules

1. Inspect before editing.
2. Prefer additive changes over destructive replacements.
3. Keep generated output isolated to predictable folders and files.
4. Preserve the host project's conventions when clear.
5. If framework conventions conflict with the default output path, adapt the generated route placement without discarding framework-specific file requirements.
6. Preserve the generated content safety guardrails and review warnings in generated page outputs.
7. If data or content generation is incomplete, scaffold with clear TODO blocks instead of inventing unsupported behavior.

## Recommended Execution Flow

### Step 1: Inspect the host project

- Confirm which framework the host project uses.
- Check whether the expected output root already exists.
- Check whether there is already an entity route structure that Sophon should extend instead of replacing.
- Identify whether the framework expects public assets under `public/`, `static/`, or another conventional directory.

### Step 2: Gather input

Ask for one of the following only if it is not already provided:

- a seed keyword or niche
- a CSV file path with entities
- the site's base URL

If the user provides both a seed keyword and CSV, prefer CSV as the source of truth and treat the seed as enrichment context.

### Step 3: Run discovery

- If a CSV path is provided, run the discovery flow in CSV mode.
- If only a seed keyword is provided, run the seed mode scaffold and store normalized placeholder entities.
- Save the result to `data/entities.json`.
- Preserve discovery metadata such as tags and CSV attributes for downstream generation.

### Step 4: Generate pages

- Generate one static page per entity using the selected framework adapter.
- Hydrate entity name, slug, SEO title, meta description, tags, and metadata attributes into each page.
- Preserve the generated hallucination-prevention comment block and content TODO sections.
- Do not hardcode niche-specific copy unless explicitly generated from project data.
- Review generation warnings for YMYL, thin content, and duplicate slug risks before publishing.
- For SvelteKit, generate both `src/routes/[slug]/+page.svelte` and the companion `src/routes/[slug]/+page.ts` file.

### Step 5: Generate technical SEO assets

- Generate `sitemap.xml`.
- Generate `robots.txt`.
- Generate schema markup scaffolds per entity.
- Generate internal linking data based on shared seed keywords and tags when possible.
- Keep generated raw technical files under predictable output paths such as `public/sophon/`.

### Step 6: Enrich content when needed

- Use `npx sophon enrich` or the programmatic `enrich()` API when the user wants AI-assisted content JSON.
- Respect `ANTHROPIC_API_KEY` from the environment.
- Do not block the overall workflow if one entity fails enrichment; continue and log the error.

### Step 7: Integrate carefully

- If the host project already has metadata helpers, align with them.
- If the host project already owns sitemap or robots generation, merge or adapt instead of duplicating blindly.
- If there is an existing SEO abstraction, plug Sophon into it.

## Command Pattern

Default to the package CLI:

```bash
npx @sophiasuu/sophon discover --seed "best payroll software"
npx @sophiasuu/sophon generate --framework nextjs
npx @sophiasuu/sophon technical --site https://example.com
```

For custom seed expansion patterns, prefer repeated `--pattern` flags:

```bash
npx @sophiasuu/sophon discover --seed "best payroll software" --pattern "{seed} alternatives" --pattern "{seed} pricing"
```

For full runs with per-step outputs:

```bash
npx @sophiasuu/sophon run --seed "best payroll software" --framework sveltekit --site https://example.com --discover-output ./data/entities.json --generate-output ./src/routes --technical-output ./static --enrich-output ./data/enriched
```

If the CLI is not built yet, install dependencies and run `npm run build` first.

## Success Criteria

The task is complete when:

- entities exist in `data/entities.json`
- framework-appropriate static pages exist for each entity
- technical SEO outputs are generated
- the generated code is easy for the user to extend
- all unsupported AI generation sections are labeled with TODOs
- generation warnings and summaries are surfaced clearly in script output

## Guardrails

- Do not fabricate live SERP data.
- Do not claim AI-generated content exists unless generation is actually wired.
- Do not remove user-authored routes without explicit approval.
- Do not hide missing integrations; mark them clearly.

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