import { gradeFromScore } from "../utils";
import type {
  EntityOptimizationResult,
  GSCPageMetrics,
  OptimizationIssueType,
  OptimizationPriority,
  EntityRecord,
} from "../../types";
import type { MappedEntity } from "./entityMapper";
import { generateRecommendations } from "./recommender";

// ── Thresholds ──────────────────────────────────────────────

const CTR_THRESHOLDS: Record<string, number> = {
  "1-3": 0.05,    // positions 1-3: expect >5% CTR
  "4-7": 0.03,    // positions 4-7: expect >3% CTR
  "8-10": 0.02,   // positions 8-10: expect >2% CTR
  "11-20": 0.01,  // positions 11-20: expect >1% CTR
};

const LOW_IMPRESSIONS_THRESHOLD = 50;
const HIGH_IMPRESSIONS_THRESHOLD = 500;
const STRIKING_DISTANCE_RANGE = [8, 20] as const;

// ── Core analysis ───────────────────────────────────────────

export function analyzeEntity(mapped: MappedEntity): EntityOptimizationResult | undefined {
  const { entity, metrics } = mapped;

  if (!metrics) {
    return {
      entity: entity.name,
      slug: entity.slug,
      metrics: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      optimizationScore: 0,
      issues: ["No GSC data found — page may not be indexed"],
      issueTypes: ["low_impressions"],
      recommendations: [
        {
          type: "structure",
          action: "Verify page is indexed and submit to Google Search Console",
          reasoning: "No performance data found for this entity's URL.",
        },
      ],
      priority: "high",
    };
  }

  const issues: string[] = [];
  const issueTypes: OptimizationIssueType[] = [];

  // Check: low CTR for position range
  const ctrIssue = checkCTR(metrics);
  if (ctrIssue) {
    issues.push(ctrIssue.message);
    issueTypes.push("low_ctr");
  }

  // Check: high impressions but low clicks
  if (metrics.impressions >= HIGH_IMPRESSIONS_THRESHOLD && metrics.ctr < 0.02) {
    issues.push(
      `High impressions (${metrics.impressions}) but low CTR (${(metrics.ctr * 100).toFixed(1)}%) — title/meta likely underperforming`,
    );
    issueTypes.push("high_impressions_low_clicks");
  }

  // Check: striking distance (position 8-20)
  if (
    metrics.position >= STRIKING_DISTANCE_RANGE[0] &&
    metrics.position <= STRIKING_DISTANCE_RANGE[1]
  ) {
    issues.push(
      `Position ${metrics.position} — in striking distance, needs content depth improvement`,
    );
    issueTypes.push("striking_distance");
  }

  // Check: poor position (>20)
  if (metrics.position > 20) {
    issues.push(
      `Position ${metrics.position} — poor ranking, may need significant content overhaul`,
    );
    issueTypes.push("poor_position");
  }

  // Check: low impressions
  if (metrics.impressions < LOW_IMPRESSIONS_THRESHOLD) {
    issues.push(
      `Low impressions (${metrics.impressions}) — possible keyword mismatch or poor indexing`,
    );
    issueTypes.push("low_impressions");
  }

  const optimizationScore = calculateScore(metrics, issueTypes);
  const recommendations = generateRecommendations(issueTypes, metrics, entity);
  const priority = scoreToPriority(optimizationScore);

  return {
    entity: entity.name,
    slug: entity.slug,
    metrics: {
      clicks: metrics.clicks,
      impressions: metrics.impressions,
      ctr: Math.round(metrics.ctr * 10000) / 10000,
      position: Math.round(metrics.position * 10) / 10,
    },
    optimizationScore,
    issues,
    issueTypes,
    recommendations,
    priority,
  };
}

export function analyzeAll(mappedEntities: MappedEntity[]): EntityOptimizationResult[] {
  return mappedEntities
    .map(analyzeEntity)
    .filter((r): r is EntityOptimizationResult => r !== undefined)
    .sort((a, b) => a.optimizationScore - b.optimizationScore);
}

// ── Helpers ─────────────────────────────────────────────────

function checkCTR(metrics: GSCPageMetrics): { message: string } | undefined {
  const pos = metrics.position;
  let expectedCtr: number;

  if (pos <= 3) {
    expectedCtr = CTR_THRESHOLDS["1-3"];
  } else if (pos <= 7) {
    expectedCtr = CTR_THRESHOLDS["4-7"];
  } else if (pos <= 10) {
    expectedCtr = CTR_THRESHOLDS["8-10"];
  } else if (pos <= 20) {
    expectedCtr = CTR_THRESHOLDS["11-20"];
  } else {
    return undefined; // Don't flag CTR for pages ranked >20
  }

  if (metrics.ctr < expectedCtr) {
    return {
      message: `Low CTR (${(metrics.ctr * 100).toFixed(1)}%) for position ${metrics.position} — expected >${(expectedCtr * 100).toFixed(0)}%`,
    };
  }

  return undefined;
}

export function calculateScore(
  metrics: GSCPageMetrics,
  issueTypes: OptimizationIssueType[],
): number {
  let score = 100;

  // Position score (0-40 points)
  if (metrics.position <= 3) {
    score -= 0;
  } else if (metrics.position <= 10) {
    score -= Math.round((metrics.position - 3) * 3); // -3 per position past 3
  } else if (metrics.position <= 20) {
    score -= 21 + Math.round((metrics.position - 10) * 2); // steeper penalty
  } else {
    score -= 40;
  }

  // CTR penalty (0-25 points)
  if (issueTypes.includes("low_ctr")) score -= 15;
  if (issueTypes.includes("high_impressions_low_clicks")) score -= 10;

  // Impressions penalty (0-20 points)
  if (metrics.impressions < LOW_IMPRESSIONS_THRESHOLD) score -= 20;
  else if (metrics.impressions < 200) score -= 10;

  // Issue count penalty (0-15 points)
  score -= Math.min(issueTypes.length * 5, 15);

  return Math.max(0, Math.min(100, score));
}

function scoreToPriority(score: number): OptimizationPriority {
  if (score < 30) return "critical";
  if (score < 50) return "high";
  if (score < 70) return "medium";
  return "low";
}
