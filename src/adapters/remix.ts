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
  ogImage: __ENTITY_OG_IMAGE__,
} as const;

const siteUrl = __SITE_URL__;
const jsonLd = __ENTITY_SCHEMA_JSONLD__;

export const meta: MetaFunction = () => {
  return [
    { title: entity.title },
    { name: "description", content: entity.description },
    { tagName: "link", rel: "canonical", href: siteUrl + "/" + entity.slug },
    { property: "og:title", content: entity.title },
    { property: "og:description", content: entity.description },
    { property: "og:url", content: siteUrl + "/" + entity.slug },
    { property: "og:type", content: "website" },
    ...(entity.ogImage ? [{ property: "og:image", content: entity.ogImage }, { property: "og:image:alt", content: entity.title }] : []),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: entity.title },
    { name: "twitter:description", content: entity.description },
    ...(entity.ogImage ? [{ name: "twitter:image", content: entity.ogImage }] : []),
  ];
};

export default function SophonPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1>{entity.title}</h1>
      <p>{entity.description}</p>
      {entity.ogImage && (
        <img src={entity.ogImage} alt={entity.title} loading="lazy" width={1200} height={630} />
      )}
__ENTITY_YMYL_DISCLAIMER__
__ENTITY_SECTIONS__
    </main>
  );
}
`;
}