import type { GenerateOptions } from "../types";

export function sveltekit(_options: GenerateOptions): string {
  return `<!-- SOPHON GENERATED -->
<!-- Do not invent statistics, prices, comparisons, or factual claims -->
<!-- All TODO sections must be filled with grounded sourced content -->
<!-- Review YMYL warnings before publishing -->

<script lang="ts">
  export let data: {
    entity: {
      name: string;
      slug: string;
      title: string;
      description: string;
      tags: string[];
      attributes: Record<string, string>;
      ogImage: string;
    };
    siteUrl: string;
    jsonLd: Record<string, unknown>;
  };
</script>

<svelte:head>
  <title>{data.entity.title}</title>
  <meta name="description" content={data.entity.description} />
  <link rel="canonical" href={\`\${data.siteUrl}/\${data.entity.slug}\`} />
  <!-- Open Graph -->
  <meta property="og:title" content={data.entity.title} />
  <meta property="og:description" content={data.entity.description} />
  <meta property="og:url" content={\`\${data.siteUrl}/\${data.entity.slug}\`} />
  <meta property="og:type" content="website" />
  {#if data.entity.ogImage}
  <meta property="og:image" content={data.entity.ogImage} />
  <meta property="og:image:alt" content={data.entity.title} />
  {/if}
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={data.entity.title} />
  <meta name="twitter:description" content={data.entity.description} />
  {#if data.entity.ogImage}
  <meta name="twitter:image" content={data.entity.ogImage} />
  {/if}
  <!-- JSON-LD Schema -->
  {@html \`<script type="application/ld+json">\${JSON.stringify(data.jsonLd)}</script>\`}
</svelte:head>

<main>
  <h1>{data.entity.title}</h1>
  <p>{data.entity.description}</p>
  {#if data.entity.ogImage}
  <img src={data.entity.ogImage} alt={data.entity.title} loading="lazy" width="1200" height="630" />
  {/if}

__ENTITY_YMYL_DISCLAIMER__
__ENTITY_SECTIONS__
</main>
`;
}