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
  ogImage: __ENTITY_OG_IMAGE__,
};

const siteUrl = __SITE_URL__;
const jsonLd = __ENTITY_SCHEMA_JSONLD__;
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{entity.title}</title>
    <meta name="description" content={entity.description} />
    <link rel="canonical" href={\`\${siteUrl}/\${entity.slug}\`} />
    <!-- Open Graph -->
    <meta property="og:title" content={entity.title} />
    <meta property="og:description" content={entity.description} />
    <meta property="og:url" content={\`\${siteUrl}/\${entity.slug}\`} />
    <meta property="og:type" content="website" />
    {entity.ogImage && <meta property="og:image" content={entity.ogImage} />}
    {entity.ogImage && <meta property="og:image:alt" content={entity.title} />}
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={entity.title} />
    <meta name="twitter:description" content={entity.description} />
    {entity.ogImage && <meta name="twitter:image" content={entity.ogImage} />}
    <!-- JSON-LD Schema -->
    <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
  </head>
  <body>
    <main>
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
      {entity.ogImage && <img src={entity.ogImage} alt={entity.title} loading="lazy" width="1200" height="630" />}
__ENTITY_YMYL_DISCLAIMER__
__ENTITY_SECTIONS__
    </main>
  </body>
</html>
`;
}