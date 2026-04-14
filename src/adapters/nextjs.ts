import type { GenerateOptions } from "../types";

export function nextjs(_options: GenerateOptions): string {
  return `// SOPHON GENERATED
// Do not invent statistics, prices, comparisons, or factual claims
// All TODO sections must be filled with grounded sourced content
// Review YMYL warnings before publishing

import type { Metadata } from "next";

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

export const metadata: Metadata = {
  title: entity.title,
  description: entity.description,
  alternates: {
    canonical: siteUrl + "/" + entity.slug,
  },
  openGraph: {
    title: entity.title,
    description: entity.description,
    url: siteUrl + "/" + entity.slug,
    type: "website",
    ...(entity.ogImage ? { images: [{ url: entity.ogImage, alt: entity.title }] } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: entity.title,
    description: entity.description,
    ...(entity.ogImage ? { images: [entity.ogImage] } : {}),
  },
};

export const dynamic = "force-static";

export default function SophonPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-950">{entity.title}</h1>
        <p className="max-w-3xl text-base leading-7 text-neutral-700">{entity.description}</p>
        {entity.ogImage && (
          <img
            src={entity.ogImage}
            alt={entity.title}
            loading="lazy"
            width={1200}
            height={630}
            className="w-full rounded-2xl"
          />
        )}
      </header>

__ENTITY_YMYL_DISCLAIMER__
      <section className="mt-10">
        <article className="space-y-8">
__ENTITY_SECTIONS__
        </article>
      </section>
    </main>
  );
}
`;
}