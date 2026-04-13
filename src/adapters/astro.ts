import type { GenerateOptions } from "../types";

export function astro(_options: GenerateOptions): string {
  return `---
// SOPHON GENERATED
// Do not invent statistics, prices, comparisons, or factual claims
// All TODO sections must be filled with grounded sourced content
// Review YMYL warnings before publishing

const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
};
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{entity.title}</title>
    <meta name="description" content={entity.description} />
    <link rel="canonical" href={\`/\${entity.slug}\`} />
    <!-- Open Graph -->
    <meta property="og:title" content={entity.title} />
    <meta property="og:description" content={entity.description} />
    <meta property="og:url" content={\`/\${entity.slug}\`} />
    <meta property="og:type" content="website" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={entity.title} />
    <meta name="twitter:description" content={entity.description} />
  </head>
  <body>
    <main>
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
      <!-- Sophon intent: __ENTITY_INTENT__ -->
__ENTITY_SECTIONS__
      <pre>{JSON.stringify({ tags: entity.tags, attributes: entity.attributes }, null, 2)}</pre>
    </main>
  </body>
</html>
`;
}