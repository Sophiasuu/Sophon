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
} as const;

export const metadata: Metadata = {
  title: entity.title,
  description: entity.description,
  alternates: {
    canonical: "/" + entity.slug,
  },
  openGraph: {
    title: entity.title,
    description: entity.description,
    url: "/" + entity.slug,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: entity.title,
    description: entity.description,
  },
};

export const dynamic = "force-static";

export default function SophonPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-16">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Sophon generated page</p>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-950">{entity.title}</h1>
        <p className="max-w-3xl text-base leading-7 text-neutral-700">{entity.description}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-8 rounded-3xl border border-neutral-200 p-8">
          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: Intro paragraph</h2>
            <p className="text-neutral-700">Replace with grounded introductory content for {entity.name}.</p>
          </section>

          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: FAQ section</h2>
            <p className="text-neutral-700">Add sourced FAQ content before publishing.</p>
          </section>

          <section className="space-y-3 rounded-3xl bg-amber-50 p-6">
            <h2 className="text-xl font-medium text-neutral-950">TODO: Comparison section</h2>
            <p className="text-neutral-700">Add evidence-based comparisons only after validating claims.</p>
          </section>
        </article>

        <aside className="space-y-6 rounded-3xl bg-neutral-50 p-8">
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-neutral-950">Tags</h2>
            <pre className="overflow-x-auto rounded-2xl bg-white p-4 text-sm text-neutral-700">{JSON.stringify(entity.tags, null, 2)}</pre>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium text-neutral-950">Attributes</h2>
            <pre className="overflow-x-auto rounded-2xl bg-white p-4 text-sm text-neutral-700">{JSON.stringify(entity.attributes, null, 2)}</pre>
          </div>
        </aside>
      </section>
    </main>
  );
}
`;
}