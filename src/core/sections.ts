import type { Framework, ProposedEntityIntent } from "../types";

export type SectionDefinition = {
  heading: string;
  placeholder: string;
};

const COMMERCIAL_SECTIONS: SectionDefinition[] = [
  { heading: "Pricing Overview", placeholder: "Add verified pricing tiers, plans, and costs. Do not invent prices." },
  { heading: "Key Features", placeholder: "List core features with factual descriptions. Link to official sources." },
  { heading: "Who Is This For?", placeholder: "Describe the ideal customer profile and primary use cases." },
  { heading: "Get Started", placeholder: "Add a clear call-to-action: free trial, demo request, or signup link." },
];

const COMPARISON_SECTIONS: SectionDefinition[] = [
  { heading: "Side-by-Side Comparison", placeholder: "Build a factual comparison table. Only include verified differences." },
  { heading: "Pros & Cons", placeholder: "List evidence-based advantages and disadvantages for each option." },
  { heading: "Best For", placeholder: "Recommend which option suits which audience or use case." },
  { heading: "Verdict", placeholder: "Provide an objective summary. Do not make unsupported claims." },
];

const SEGMENTED_SECTIONS: SectionDefinition[] = [
  { heading: "Pain Points", placeholder: "Describe the specific challenges this audience faces." },
  { heading: "Tailored Use Cases", placeholder: "Show how the solution addresses this segment's specific needs." },
  { heading: "Success Stories", placeholder: "Add real case studies or testimonials. Do not fabricate quotes." },
  { heading: "Next Steps", placeholder: "Provide a segment-specific call-to-action." },
];

const INFORMATIONAL_SECTIONS: SectionDefinition[] = [
  { heading: "What You Need to Know", placeholder: "Write a comprehensive introduction to the topic." },
  { heading: "Step-by-Step Guide", placeholder: "Break down the process into clear, actionable steps." },
  { heading: "Frequently Asked Questions", placeholder: "Add sourced FAQ content. Validate all answers." },
  { heading: "Related Resources", placeholder: "Link to authoritative external and internal resources." },
];

const SECTIONS_BY_INTENT: Record<ProposedEntityIntent, SectionDefinition[]> = {
  commercial: COMMERCIAL_SECTIONS,
  comparison: COMPARISON_SECTIONS,
  segmented: SEGMENTED_SECTIONS,
  informational: INFORMATIONAL_SECTIONS,
};

export function getSections(intent: ProposedEntityIntent): SectionDefinition[] {
  return SECTIONS_BY_INTENT[intent];
}

function renderWithIndent(sections: SectionDefinition[], indent: number, gap: string, tailwind: boolean): string {
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);

  if (tailwind) {
    return sections
      .map(
        (s) =>
          `${pad}<section className="space-y-3 rounded-3xl bg-amber-50 p-6">\n${inner}<h2 className="text-xl font-medium text-neutral-950">TODO: ${s.heading}</h2>\n${inner}<p className="text-neutral-700">${s.placeholder}</p>\n${pad}</section>`,
      )
      .join(gap);
  }

  return sections
    .map(
      (s) =>
        `${pad}<section>\n${inner}<h2>TODO: ${s.heading}</h2>\n${inner}<p>${s.placeholder}</p>\n${pad}</section>`,
    )
    .join(gap);
}

export function renderSections(framework: Framework, sections: SectionDefinition[]): string {
  switch (framework) {
    case "nextjs":
      return renderWithIndent(sections, 10, "\n\n", true);
    case "sveltekit":
      return renderWithIndent(sections, 2, "\n\n", false);
    case "remix":
      return renderWithIndent(sections, 6, "\n", false);
    case "astro":
      return renderWithIndent(sections, 6, "\n", false);
    case "nuxt":
      return renderWithIndent(sections, 4, "\n", false);
  }
}
