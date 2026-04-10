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
    };
  };
</script>

<svelte:head>
  <title>{data.entity.title}</title>
  <meta name="description" content={data.entity.description} />
</svelte:head>

<main>
  <h1>{data.entity.title}</h1>
  <p>{data.entity.description}</p>

  <section>
    <h2>TODO: Intro paragraph</h2>
    <p>Replace with grounded introductory content for {data.entity.name}.</p>
  </section>

  <section>
    <h2>TODO: FAQ section</h2>
    <p>Add sourced FAQ content before publishing.</p>
  </section>

  <section>
    <h2>TODO: Comparison section</h2>
    <p>Add evidence-based comparisons only after validating claims.</p>
  </section>

  <pre>{JSON.stringify({ tags: data.entity.tags, attributes: data.entity.attributes }, null, 2)}</pre>
</main>
`;
}