---
name: generate
description: "Generate one static framework page per entity using the appropriate Sophon adapter. Supports Next.js, Astro, Nuxt, SvelteKit, and Remix. Use when the user wants to scaffold programmatic SEO pages."
argument-hint: "[--framework <name>]"
---

Generate one static page per entity using the framework adapter that matches the host project.

## MANDATORY PREPARATION

Invoke the `sophon` skill first. It contains the adapter map, entity model, output path conventions, and the **Context Gathering Protocol**.

**Follow the protocol before doing any work:**
1. Check loaded instructions for a `## Sophon Project Context` section.
2. Check `.sophon.md` in the project root.
3. If neither exists, run `sophon teach` now — do NOT skip this step.

---

## Framework Detection

Sophon auto-detects the framework from `package.json`. Pass `--framework` explicitly to override:

| Framework | Auto-detected from | Output root |
|-----------|-------------------|-------------|
| `nextjs` | `next` dependency | `app/` |
| `astro` | `astro` dependency | `src/pages/` |
| `nuxt` | `nuxt` dependency | `pages/` |
| `sveltekit` | `@sveltejs/kit` | `src/routes/` |
| `remix` | `@remix-run/react` | `app/routes/` |

## Execution

```bash
npx @sophonn/sophon generate --framework nextjs

# Custom output root
npx @sophonn/sophon generate --framework astro --generate-output ./src/pages
```

## Output Paths by Framework

| Framework | Files generated per entity |
|-----------|---------------------------|
| Next.js | `app/[slug]/page.tsx` |
| Astro | `src/pages/[slug].astro` |
| Nuxt 3 | `pages/[slug].vue` |
| SvelteKit | `src/routes/[slug]/+page.svelte` + `src/routes/[slug]/+page.ts` |
| Remix | `app/routes/[slug].tsx` |

**SvelteKit**: Always generates both files. `+page.ts` contains the prerenderable entity payload that feeds `+page.svelte`. Do not skip generating the companion file.

## Generated Page Content

Each generated page includes:

**SEO metadata (auto-populated per entity)**
- `<title>` and `<meta name="description">`
- Canonical URL (`<link rel="canonical">` or `alternates.canonical`)
- Open Graph tags: `og:title`, `og:description`, `og:url`, `og:type`
- Twitter Card tags: `twitter:card`, `twitter:title`, `twitter:description`

**Page structure**
- H1 populated from entity SEO title
- H2 sections scaffolded for intro, FAQ, and comparison — all as `// TODO` blocks
- Entity tags and attributes rendered for reference

**Safety guardrails**
- Hallucination-prevention comment block at the top — **preserve it**
- YMYL warning logged if entity name/tags match health, legal, or financial terms
- Thin-content warning logged if entity has fewer than 3 populated metadata fields
- Duplicate slugs are skipped automatically with a logged warning

Do not hardcode niche-specific copy into generated pages unless it comes from actual project data.

## Programmatic API

```ts
import { generate } from "@sophonn/sophon";

await generate({
  entities: result.entities,
  framework: "nextjs",
  output: "app",
});
```

## After Generation

Run the `technical` skill to generate sitemap, schema, and hreflang scaffold assets.
