import type { GenerateOptions } from "../types";

export function nuxt(_options: GenerateOptions): string {
  return `<!-- SOPHON GENERATED -->
<!-- Do not invent statistics, prices, comparisons, or factual claims -->
<!-- All TODO sections must be filled with grounded sourced content -->
<!-- Review YMYL warnings before publishing -->

<script setup lang="ts">
const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
} as const;

const siteUrl = __SITE_URL__;
const jsonLd = __ENTITY_SCHEMA_JSONLD__;

definePageMeta({
  layout: "default",
});

useHead({
  title: entity.title,
  meta: [
    { name: "description", content: entity.description },
    { property: "og:title", content: entity.title },
    { property: "og:description", content: entity.description },
    { property: "og:url", content: siteUrl + "/" + entity.slug },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: entity.title },
    { name: "twitter:description", content: entity.description },
  ],
  link: [{ rel: "canonical", href: siteUrl + "/" + entity.slug }],
  script: [{ type: "application/ld+json", innerHTML: JSON.stringify(jsonLd) }],
});
</script>

<template>
  <main>
    <h1>{{ entity.title }}</h1>
    <p>{{ entity.description }}</p>
__ENTITY_YMYL_DISCLAIMER__
__ENTITY_SECTIONS__
  </main>
</template>
`;
}