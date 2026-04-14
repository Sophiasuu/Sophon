/**
 * Keyword data integration — keyword scoring and volume estimation.
 * Supports heuristic estimation when no real data is available,
 * or importing real keyword data from CSV (e.g. Ahrefs, SEMrush, Google Keyword Planner exports).
 */

import { readFile } from "node:fs/promises";

import type { EntityRecord, ProposedEntityIntent } from "../types";
import { classifyIntent } from "./intent";
import { slugify } from "./utils";

export type KeywordDifficulty = "easy" | "medium" | "hard";

export type KeywordData = {
  keyword: string;
  slug: string;
  estimatedMonthlyVolume: number;
  difficulty: KeywordDifficulty;
  intent: ProposedEntityIntent;
  cpcEstimate: string;
  opportunityScore: number;
  dataSource: "heuristic" | "imported";
};

export type KeywordImportRow = {
  keyword: string;
  volume?: number;
  difficulty?: number;
  cpc?: number;
};

// ── CSV keyword data import ────────────────────────────────

function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      columns.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  columns.push(current.trim());
  return columns;
}

function detectColumnIndex(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const alias of aliases) {
    const idx = lower.indexOf(alias.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function importKeywordData(csvPath: string): Promise<Map<string, KeywordImportRow>> {
  const raw = await readFile(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return new Map();

  const headers = parseCsvLine(lines[0]);
  const kwIdx = detectColumnIndex(headers, ["keyword", "query", "search term", "term", "keyphrase"]);
  const volIdx = detectColumnIndex(headers, ["volume", "search volume", "avg monthly searches", "monthly volume"]);
  const diffIdx = detectColumnIndex(headers, ["difficulty", "kd", "keyword difficulty", "competition"]);
  const cpcIdx = detectColumnIndex(headers, ["cpc", "cost per click", "avg cpc"]);

  if (kwIdx === -1) return new Map();

  const result = new Map<string, KeywordImportRow>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const keyword = cols[kwIdx]?.trim();
    if (!keyword) continue;

    result.set(slugify(keyword), {
      keyword,
      volume: volIdx !== -1 ? Number.parseInt(cols[volIdx], 10) || undefined : undefined,
      difficulty: diffIdx !== -1 ? Number.parseFloat(cols[diffIdx]) || undefined : undefined,
      cpc: cpcIdx !== -1 ? Number.parseFloat(cols[cpcIdx].replace(/[$€£]/g, "")) || undefined : undefined,
    });
  }

  return result;
}

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

// ── Difficulty from numeric score ───────────────────────────

function difficultyFromScore(score: number): KeywordDifficulty {
  if (score <= 30) return "easy";
  if (score <= 60) return "medium";
  return "hard";
}

// ── Public API ─────────────────────────────────────────────

export function analyzeKeyword(entity: EntityRecord, imported?: Map<string, KeywordImportRow>): KeywordData {
  const { intent } = classifyIntent(entity.name);
  const row = imported?.get(entity.slug);

  if (row) {
    const volume = row.volume ?? estimateVolume(entity.name);
    const difficulty = row.difficulty !== undefined ? difficultyFromScore(row.difficulty) : estimateDifficulty(entity.name);
    const cpc = row.cpc !== undefined ? `$${row.cpc.toFixed(2)}` : estimateCpc(intent);

    return {
      keyword: entity.name,
      slug: entity.slug,
      estimatedMonthlyVolume: volume,
      difficulty,
      intent,
      cpcEstimate: cpc,
      opportunityScore: calculateOpportunity(volume, difficulty, intent),
      dataSource: "imported",
    };
  }

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
    dataSource: "heuristic",
  };
}

export function analyzeKeywords(entities: EntityRecord[], imported?: Map<string, KeywordImportRow>): KeywordData[] {
  return entities
    .map((e) => analyzeKeyword(e, imported))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}
