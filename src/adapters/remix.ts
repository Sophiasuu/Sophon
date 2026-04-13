import type { GenerateOptions } from "../types";

export function remix(_options: GenerateOptions): string {
  return `// SOPHON GENERATED
// Do not invent statistics, prices, comparisons, or factual claims
// All TODO sections must be filled with grounded sourced content
// Review YMYL warnings before publishing

import type { MetaFunction } from "@remix-run/node";

const entity = {
  name: __ENTITY_NAME__,
  slug: __ENTITY_SLUG__,
  title: __ENTITY_TITLE__,
  description: __ENTITY_DESCRIPTION__,
  tags: __ENTITY_TAGS__,
  attributes: __ENTITY_ATTRIBUTES__,
} as const;

export const meta: MetaFunction = () => {
  return [
    { title: entity.title },
    { name: "description", content: entity.description },
    { tagName: "link", rel: "canonical", href: "/" + entity.slug },
    { property: "og:title", content: entity.title },
    { property: "og:description", content: entity.description },
    { property: "og:url", content: "/" + entity.slug },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: entity.title },
    { name: "twitter:description", content: entity.description },
  ];
};

export default function SophonPage() {
  return (
    <main>
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
      {/* Sophon intent: __ENTITY_INTENT__ */}
__ENTITY_SECTIONS__
      <pre>{JSON.stringify({ tags: entity.tags, attributes: entity.attributes }, null, 2)}</pre>
    </main>
  );
}
`;
}