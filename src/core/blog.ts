/**
 * Blog / supporting content generation — creates supporting article
 * outlines for entity pages to build topical authority and internal linking.
 */

import path from "node:path";

import { writeGeneratedFile } from "./generate";
import { classifyIntent } from "./intent";
import type { EntityRecord, ProposedEntityIntent } from "../types";

export type BlogOutline = {
  slug: string;
  parentEntity: string;
  title: string;
  intent: ProposedEntityIntent;
  sections: string[];
  internalLinks: string[];
  targetKeywords: string[];
};

export type BlogOptions = {
  entities: EntityRecord[];
  output?: string;
  postsPerEntity?: number;
};

// ── Topic generators by intent ─────────────────────────────

type TopicTemplate = {
  titleTemplate: string;
  sections: string[];
};

const TOPIC_TEMPLATES: Record<ProposedEntityIntent, TopicTemplate[]> = {
  commercial: [
    {
      titleTemplate: "Is {name} Worth It? Honest Review ({year})",
      sections: ["What it does", "Key features", "Pricing breakdown", "Who should use it", "Final verdict"],
    },
    {
      titleTemplate: "How to Choose the Right {seed}: A Buyer's Guide",
      sections: ["What to look for", "Must-have features", "Common pitfalls", "Price ranges", "Our recommendation"],
    },
  ],
  comparison: [
    {
      titleTemplate: "{name}: Which One Wins? (Detailed Comparison)",
      sections: ["Overview of each option", "Feature comparison table", "Pricing comparison", "Use case fit", "Bottom line"],
    },
    {
      titleTemplate: "Switching from {name}? What You Need to Know",
      sections: ["Why people switch", "Migration considerations", "Feature gaps", "Cost impact", "Transition checklist"],
    },
  ],
  segmented: [
    {
      titleTemplate: "How {name} Solves Real Problems ({year})",
      sections: ["Common pain points", "How the solution helps", "Implementation guide", "Results to expect", "Getting started"],
    },
    {
      titleTemplate: "{name}: Success Stories and Lessons Learned",
      sections: ["Background", "Challenges faced", "Solution approach", "Outcomes", "Key takeaways"],
    },
  ],
  informational: [
    {
      titleTemplate: "What Is {name}? Everything You Need to Know",
      sections: ["Definition", "How it works", "Key benefits", "Common use cases", "FAQ"],
    },
    {
      titleTemplate: "The Complete Guide to {name} ({year})",
      sections: ["Introduction", "Core concepts", "Step-by-step walkthrough", "Tips and best practices", "Resources"],
    },
  ],
};

// ── Blog outline generation ────────────────────────────────

function buildOutlinesForEntity(entity: EntityRecord, postsPerEntity: number): BlogOutline[] {
  const { intent } = classifyIntent(entity.name);
  const templates = TOPIC_TEMPLATES[intent];
  const year = new Date().getFullYear().toString();
  const seed = entity.seedKeyword ?? entity.name.split(/\s+/).slice(0, 2).join(" ");

  return templates.slice(0, postsPerEntity).map((template, index) => {
    const title = template.titleTemplate
      .replaceAll("{name}", entity.name)
      .replaceAll("{seed}", seed)
      .replaceAll("{year}", year);

    const slug = `blog/${entity.slug}-${index + 1}`;

    return {
      slug,
      parentEntity: entity.slug,
      title,
      intent,
      sections: template.sections,
      internalLinks: [`/${entity.slug}`],
      targetKeywords: [entity.name, ...(entity.metadata.tags ?? [])],
    };
  });
}

export function generateBlogOutlines(entities: EntityRecord[], postsPerEntity = 2): BlogOutline[] {
  return entities.flatMap((entity) => buildOutlinesForEntity(entity, postsPerEntity));
}

// ── Main entry point ───────────────────────────────────────

export async function blog(options: BlogOptions): Promise<BlogOutline[]> {
  const outputRoot = options.output ?? path.join("data", "blog");
  const postsPerEntity = options.postsPerEntity ?? 2;

  const outlines = generateBlogOutlines(options.entities, postsPerEntity);

  await writeGeneratedFile(
    path.join(outputRoot, "blog-outlines.json"),
    `${JSON.stringify(outlines, null, 2)}\n`,
  );

  console.log(`Blog outlines generated: ${outlines.length} posts for ${options.entities.length} entities`);

  return outlines;
}
