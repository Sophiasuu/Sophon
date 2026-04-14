import type {
  EntityRecord,
  GSCPageMetrics,
  OptimizationIssueType,
  OptimizationRecommendation,
} from "../../types";

type RecommendationRule = {
  issueTypes: OptimizationIssueType[];
  generate: (metrics: GSCPageMetrics, entity: EntityRecord) => OptimizationRecommendation[];
};

const RULES: RecommendationRule[] = [
  {
    issueTypes: ["low_ctr", "high_impressions_low_clicks"],
    generate: (_metrics, entity) => [
      {
        type: "meta",
        action: `Rewrite title tag for "${entity.name}" — use power words, numbers, or brackets`,
        reasoning:
          "Low CTR relative to position indicates the title/meta description is not compelling enough in search results.",
      },
      {
        type: "meta",
        action: "Improve meta description with a clear CTA and value proposition",
        reasoning:
          "A stronger meta description can significantly improve CTR without changing position.",
      },
    ],
  },
  {
    issueTypes: ["striking_distance"],
    generate: (_metrics, entity) => [
      {
        type: "content",
        action: `Add 2-3 new sections to increase content depth for "${entity.name}"`,
        reasoning:
          "Pages in positions 8-20 are in striking distance of page 1. Additional content depth can push rankings higher.",
      },
      {
        type: "structure",
        action: "Add FAQ section with schema markup",
        reasoning:
          "FAQ schema can earn rich results and increase SERP visibility, boosting CTR.",
      },
      {
        type: "linking",
        action: "Add internal links from high-authority pages to this entity",
        reasoning:
          "Internal links pass authority. Linking from strong pages can improve ranking for striking-distance pages.",
      },
    ],
  },
  {
    issueTypes: ["poor_position"],
    generate: (_metrics, entity) => [
      {
        type: "content",
        action: `Significantly expand content for "${entity.name}" — aim for comprehensive coverage`,
        reasoning:
          "Poor position (>20) indicates the page needs substantial content improvement to compete.",
      },
      {
        type: "structure",
        action: "Review and align page structure with top-ranking competitors",
        reasoning:
          "Pages ranked poorly often lack the content structure that Google favors for this query type.",
      },
      {
        type: "meta",
        action: "Review target keyword alignment — ensure title and H1 match search intent",
        reasoning:
          "Keyword mismatch between page content and user search intent can cause poor rankings.",
      },
    ],
  },
  {
    issueTypes: ["low_impressions"],
    generate: (_metrics, entity) => [
      {
        type: "structure",
        action: "Verify page is indexed — check Google Search Console coverage report",
        reasoning:
          "Low impressions may indicate the page is not indexed or has crawl issues.",
      },
      {
        type: "content",
        action: `Review target keyword for "${entity.name}" — may need keyword pivot`,
        reasoning:
          "If the page gets few impressions, the target keyword may have minimal search volume or the page may not be relevant enough.",
      },
    ],
  },
  {
    issueTypes: ["intent_mismatch"],
    generate: (_metrics, entity) => [
      {
        type: "structure",
        action: `Restructure page for "${entity.name}" to match dominant search intent`,
        reasoning:
          "Pages that don't match search intent (informational vs commercial) underperform in rankings.",
      },
      {
        type: "content",
        action: "Add comparison table or product breakdown if intent is commercial",
        reasoning:
          "Commercial intent queries expect comparison content rather than informational articles.",
      },
    ],
  },
  {
    issueTypes: ["weak_linking"],
    generate: () => [
      {
        type: "linking",
        action: "Build internal link cluster — link 3-5 related entity pages bidirectionally",
        reasoning:
          "Weak internal linking reduces topical authority signals. Cross-linking related entities improves crawlability and ranking.",
      },
    ],
  },
];

export function generateRecommendations(
  issueTypes: OptimizationIssueType[],
  metrics: GSCPageMetrics,
  entity: EntityRecord,
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const matches = rule.issueTypes.some((t) => issueTypes.includes(t));
    if (!matches) continue;

    for (const rec of rule.generate(metrics, entity)) {
      // Deduplicate by action string
      if (!seen.has(rec.action)) {
        seen.add(rec.action);
        recommendations.push(rec);
      }
    }
  }

  return recommendations;
}
