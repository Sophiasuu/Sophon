/**
 * Keyword data integration — basic keyword scoring and volume estimation.
 * Uses heuristic signals (word count, modifier presence, competition indicators)
 * since we don't depend on paid keyword APIs.
 */

import type { EntityRecord, ProposedEntityIntent } from "../types";
import { classifyIntent } from "./intent";

export type KeywordDifficulty = "easy" | "medium" | "hard";

export type KeywordData = {
  keyword: string;
  slug: string;
  estimatedMonthlyVolume: number;
  difficulty: KeywordDifficulty;
  intent: ProposedEntityIntent;
  cpcEstimate: string;
  opportunityScore: number;
};

// ── Volume estimation heuristics ───────────────────────────

const HIGH_VOLUME_MODIFIERS = /\b(?:best|top|free|cheap|review|how to|what is)\b/i;
const MEDIUM_VOLUME_MODIFIERS = /\b(?:vs|alternative|comparison|pricing|cost)\b/i;
const LONG_TAIL_THRESHOLD = 4; // words

function estimateVolume(name: string): number {
  const wordCount = name.split(/\s+/).length;
  let base = 1000;

  // Shorter keywords = higher volume
  if (wordCount <= 2) base = 5000;
  else if (wordCount <= 3) base = 2000;
  else if (wordCount >= LONG_TAIL_THRESHOLD) base = 500;

  // Modifier boost
  if (HIGH_VOLUME_MODIFIERS.test(name)) base = Math.round(base * 1.5);
  else if (MEDIUM_VOLUME_MODIFIERS.test(name)) base = Math.round(base * 1.2);

  // Add deterministic variance based on name to avoid identical estimates
  const variance = (name.length * 17) % 300;
  return base + variance;
}

// ── Difficulty estimation ──────────────────────────────────

const HIGH_COMPETITION_TERMS = /\b(?:software|platform|tool|app|crm|erp|saas)\b/i;

function estimateDifficulty(name: string): KeywordDifficulty {
  const wordCount = name.split(/\s+/).length;

  if (wordCount >= LONG_TAIL_THRESHOLD) return "easy";
  if (HIGH_COMPETITION_TERMS.test(name) && wordCount <= 2) return "hard";
  if (MEDIUM_VOLUME_MODIFIERS.test(name)) return "medium";

  return wordCount <= 2 ? "hard" : "medium";
}

// ── CPC estimate ───────────────────────────────────────────

function estimateCpc(intent: ProposedEntityIntent): string {
  switch (intent) {
    case "commercial":
      return "$2.50-5.00";
    case "comparison":
      return "$1.50-3.50";
    case "segmented":
      return "$1.00-2.50";
    case "informational":
      return "$0.30-1.00";
  }
}

// ── Opportunity score ──────────────────────────────────────

function calculateOpportunity(volume: number, difficulty: KeywordDifficulty, intent: ProposedEntityIntent): number {
  const difficultyMultiplier = difficulty === "easy" ? 1.0 : difficulty === "medium" ? 0.7 : 0.4;
  const intentMultiplier = intent === "commercial" ? 1.0 : intent === "comparison" ? 0.85 : intent === "segmented" ? 0.7 : 0.5;

  // Normalize volume to 0-50 range, multiply by intent+difficulty
  const volumeScore = Math.min(50, Math.round((volume / 5000) * 50));
  const compositeScore = Math.round(volumeScore * difficultyMultiplier * intentMultiplier * 2);

  return Math.min(100, Math.max(0, compositeScore));
}

// ── Public API ─────────────────────────────────────────────

export function analyzeKeyword(entity: EntityRecord): KeywordData {
  const { intent } = classifyIntent(entity.name);
  const volume = estimateVolume(entity.name);
  const difficulty = estimateDifficulty(entity.name);

  return {
    keyword: entity.name,
    slug: entity.slug,
    estimatedMonthlyVolume: volume,
    difficulty,
    intent,
    cpcEstimate: estimateCpc(intent),
    opportunityScore: calculateOpportunity(volume, difficulty, intent),
  };
}

export function analyzeKeywords(entities: EntityRecord[]): KeywordData[] {
  return entities
    .map(analyzeKeyword)
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}
