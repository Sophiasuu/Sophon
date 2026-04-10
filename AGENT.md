# AGENT.md

This file instructs Claude Code how to run Sophon autonomously inside any user's existing Next.js project.

## Mission

Turn a seed keyword, niche, or CSV entity list into a production-ready programmatic SEO scaffold for a Next.js App Router application.

Claude Code should:

1. inspect the existing Next.js project structure
2. discover or import entities
3. generate one static route per entity page
4. generate technical SEO assets
5. leave explicit TODO markers where AI generation, scraping, or business-specific logic should be added
6. avoid breaking existing routes or overwriting custom application code unnecessarily

## Assumptions

- The target project is a Next.js application using the App Router.
- The project owner wants Sophon integrated with minimal manual setup.
- Sophon should remain framework agnostic in its core concepts, but output should target Next.js first.

## Operating Rules

1. Inspect before editing.
2. Prefer additive changes over destructive replacements.
3. Keep generated output isolated to predictable folders and files.
4. Preserve the host project's conventions when clear.
5. If routing structure conflicts with `app/[entity]/page.tsx`, adapt the generated route to the project's existing conventions.
6. Preserve the generated content safety guardrails and review warnings in generated page outputs.
7. If data or content generation is incomplete, scaffold with clear TODO blocks instead of inventing unsupported behavior.

## Recommended Execution Flow

### Step 1: Inspect the host project

- Confirm the project is Next.js.
- Check whether the App Router exists under `app/`.
- Check whether there is already an entity route that Sophon should extend instead of replacing.
- Identify whether `public/` exists for `sitemap.xml` and `robots.txt` outputs.

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

- Generate one static page per entity at `app/[slug]/page.tsx`.
- Hydrate entity name, slug, SEO title, meta description, tags, and metadata attributes into each page.
- Preserve the generated hallucination-prevention comment block and content TODO sections.
- Do not hardcode niche-specific copy unless explicitly generated from project data.
- Review generation warnings for YMYL, thin content, and duplicate slug risks before publishing.

### Step 5: Generate technical SEO assets

- Generate `sitemap.xml`.
- Generate `robots.txt`.
- Generate schema markup scaffolds per entity.
- Generate internal linking data based on shared seed keywords and tags when possible.
- Keep generated raw technical files under predictable output paths such as `public/sophon/`.

### Step 6: Integrate carefully

- If the host project already has metadata helpers, align with them.
- If the host project already owns sitemap or robots generation, merge or adapt instead of duplicating blindly.
- If there is an existing SEO abstraction, plug Sophon into it.

## Command Pattern

If the environment supports `tsx`, use:

```bash
npx tsx scripts/discover.ts --seed "best payroll software"
npx tsx scripts/generate.ts --output ./app
npx tsx scripts/technical.ts --site https://example.com --output ./public
```

For custom seed expansion patterns, prefer repeated `--pattern` flags:

```bash
npx tsx scripts/discover.ts --seed "best payroll software" --pattern "{seed} alternatives" --pattern "{seed} pricing"
```

If `tsx` is missing, add the smallest reasonable script-running dependency or explain what needs to be installed.

## Success Criteria

The task is complete when:

- entities exist in `data/entities.json`
- static Next.js App Router pages exist for each entity
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
Use Sophon to build a pSEO surface for "best time tracking software" in this project.
```

```text
Use Sophon with ./input/saas-entities.csv and generate pages plus sitemap output for https://example.com.
```

```text
Integrate Sophon into this existing Next.js app, but preserve the current metadata utilities and route structure.
```