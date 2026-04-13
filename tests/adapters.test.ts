import { describe, it, expect } from "vitest";

import { nextjs } from "../src/adapters/nextjs";
import { astro } from "../src/adapters/astro";
import { nuxt } from "../src/adapters/nuxt";
import { remix } from "../src/adapters/remix";
import { sveltekit } from "../src/adapters/sveltekit";
import { buildSvelteKitPageModule } from "../src/adapters/sveltekit-page";
import type { GenerateOptions, EntityRecord } from "../src/types";

function makeOptions(): GenerateOptions {
  const entity: EntityRecord = {
    id: "abc123",
    name: "test entity",
    slug: "test-entity",
    source: "seed",
    metadata: { title: "Test Entity" },
  };
  return { entities: [entity], framework: "nextjs" };
}

const PLACEHOLDERS = [
  "__ENTITY_NAME__",
  "__ENTITY_SLUG__",
  "__ENTITY_TITLE__",
  "__ENTITY_DESCRIPTION__",
  "__ENTITY_TAGS__",
  "__ENTITY_ATTRIBUTES__",
  "__ENTITY_SECTIONS__",
  "__ENTITY_INTENT__",
];

describe("nextjs adapter", () => {
  it("returns a string containing all entity placeholders", () => {
    const template = nextjs(makeOptions());
    for (const placeholder of PLACEHOLDERS) {
      expect(template).toContain(placeholder);
    }
  });

  it("contains Metadata import", () => {
    expect(nextjs(makeOptions())).toContain("import type { Metadata }");
  });

  it("contains SOPHON GENERATED marker", () => {
    expect(nextjs(makeOptions())).toContain("SOPHON GENERATED");
  });

  it("contains canonical URL", () => {
    expect(nextjs(makeOptions())).toContain("canonical");
  });

  it("contains Open Graph metadata", () => {
    expect(nextjs(makeOptions())).toContain("openGraph");
  });

  it("contains Twitter card metadata", () => {
    expect(nextjs(makeOptions())).toContain("twitter");
  });
});

describe("astro adapter", () => {
  it("returns a string containing all entity placeholders", () => {
    const template = astro({ ...makeOptions(), framework: "astro" });
    for (const placeholder of PLACEHOLDERS) {
      expect(template).toContain(placeholder);
    }
  });

  it("contains frontmatter fences", () => {
    const template = astro({ ...makeOptions(), framework: "astro" });
    expect(template).toContain("---");
  });

  it("contains html structure", () => {
    const template = astro({ ...makeOptions(), framework: "astro" });
    expect(template).toContain("<html");
    expect(template).toContain("</html>");
  });

  it("contains OG tags", () => {
    const template = astro({ ...makeOptions(), framework: "astro" });
    expect(template).toContain("og:title");
  });
});

describe("nuxt adapter", () => {
  it("returns a string containing all entity placeholders", () => {
    const template = nuxt({ ...makeOptions(), framework: "nuxt" });
    for (const placeholder of PLACEHOLDERS) {
      expect(template).toContain(placeholder);
    }
  });

  it("contains script setup", () => {
    const template = nuxt({ ...makeOptions(), framework: "nuxt" });
    expect(template).toContain("<script setup lang=\"ts\">");
  });

  it("contains template block", () => {
    const template = nuxt({ ...makeOptions(), framework: "nuxt" });
    expect(template).toContain("<template>");
    expect(template).toContain("</template>");
  });

  it("contains useHead for SEO meta", () => {
    const template = nuxt({ ...makeOptions(), framework: "nuxt" });
    expect(template).toContain("useHead");
    expect(template).toContain("og:title");
    expect(template).toContain("twitter:card");
  });
});

describe("remix adapter", () => {
  it("returns a string containing all entity placeholders", () => {
    const template = remix({ ...makeOptions(), framework: "remix" });
    for (const placeholder of PLACEHOLDERS) {
      expect(template).toContain(placeholder);
    }
  });

  it("contains MetaFunction import", () => {
    expect(remix({ ...makeOptions(), framework: "remix" })).toContain("MetaFunction");
  });

  it("contains meta export", () => {
    expect(remix({ ...makeOptions(), framework: "remix" })).toContain("export const meta");
  });
});

describe("sveltekit adapter", () => {
  it("returns a string containing section and intent placeholders", () => {
    const template = sveltekit({ ...makeOptions(), framework: "sveltekit" });
    expect(template).toContain("__ENTITY_SECTIONS__");
    expect(template).toContain("__ENTITY_INTENT__");
  });

  it("uses data prop instead of inline entity values", () => {
    const template = sveltekit({ ...makeOptions(), framework: "sveltekit" });
    // SvelteKit uses data.entity from +page.ts, not inline __ENTITY_NAME__ etc.
    expect(template).toContain("data.entity.title");
    expect(template).not.toContain("__ENTITY_NAME__");
  });

  it("contains svelte:head for SEO meta", () => {
    const template = sveltekit({ ...makeOptions(), framework: "sveltekit" });
    expect(template).toContain("<svelte:head>");
    expect(template).toContain("og:title");
    expect(template).toContain("twitter:card");
  });

  it("contains script block with typed data prop", () => {
    const template = sveltekit({ ...makeOptions(), framework: "sveltekit" });
    expect(template).toContain("<script lang=\"ts\">");
    expect(template).toContain("export let data");
  });
});

describe("sveltekit page module", () => {
  it("contains entity placeholders", () => {
    const template = buildSvelteKitPageModule();
    expect(template).toContain("__ENTITY_NAME__");
    expect(template).toContain("__ENTITY_SLUG__");
    expect(template).toContain("__ENTITY_TITLE__");
    expect(template).toContain("__ENTITY_DESCRIPTION__");
    expect(template).toContain("__ENTITY_TAGS__");
    expect(template).toContain("__ENTITY_ATTRIBUTES__");
  });

  it("exports prerender and load function", () => {
    const template = buildSvelteKitPageModule();
    expect(template).toContain("export const prerender = true");
    expect(template).toContain("export function load()");
  });

  it("returns entity from load function", () => {
    const template = buildSvelteKitPageModule();
    expect(template).toContain("return {");
    expect(template).toContain("entity");
  });
});
