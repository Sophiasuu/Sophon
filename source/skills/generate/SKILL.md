---
name: generate
description: "Generate one static framework page per entity using the appropriate Sophon adapter. Supports Next.js, Astro, Nuxt, SvelteKit, and Remix. Use when the user wants to scaffold programmatic SEO pages."
argument-hint: "[--framework <name>]"
user-invocable: true
---

Generate one static page per entity using the framework adapter that matches the host project.

## MANDATORY PREPARATION

Invoke the `sophon` skill first. It contains the adapter map, entity model, and output path conventions.

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

Each generated page:
- Hydrates entity name, slug, SEO title, meta description, tags, and metadata attributes
- Contains a hallucination-prevention comment block — **preserve it**
- Contains `// TODO` content sections where AI generation or business logic must be wired in
- Includes YMYL and thin-content review warnings

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

Review generated pages for duplicate slug risks, then run the `technical` skill to generate sitemap and schema assets.
