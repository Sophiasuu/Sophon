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

definePageMeta({
  layout: "default",
});

useHead({
  title: entity.title,
  meta: [{ name: "description", content: entity.description }],
  link: [{ rel: "canonical", href: "/" + entity.slug }],
});
</script>

<template>
  <main>
    <h1>{{ entity.title }}</h1>
    <p>{{ entity.description }}</p>
    <section>
      <h2>TODO: Intro paragraph</h2>
      <p>Replace with grounded introductory content for {{ entity.name }}.</p>
    </section>
    <section>
      <h2>TODO: FAQ section</h2>
      <p>Add sourced FAQ content before publishing.</p>
    </section>
    <section>
      <h2>TODO: Comparison section</h2>
      <p>Add evidence-based comparisons only after validating claims.</p>
    </section>
    <pre>{{ JSON.stringify({ tags: entity.tags, attributes: entity.attributes }, null, 2) }}</pre>
  </main>
</template>
`;
}