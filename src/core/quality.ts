/**
 * Content quality scoring — evaluate generated/enriched content
 * for word count, readability, heading structure, and uniqueness signals.
 */

import type { EntityRecord } from "../types";

export type QualityCheck = {
  label: string;
  score: number;
  maxScore: number;
  passed: boolean;
  detail?: string;
};

export type ContentQualityResult = {
  slug: string;
  name: string;
  overallScore: number;
  grade: string;
  checks: QualityCheck[];
};

export type QualityReport = {
  generatedAt: string;
  entityCount: number;
  averageScore: number;
  averageGrade: string;
  entities: ContentQualityResult[];
};

// ── Word count ──────────────────────────────────────────────

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ── Flesch-Kincaid readability ──────────────────────────────

function syllableCount(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;

  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;

  for (const char of w) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Silent e
  if (w.endsWith("e") && count > 1) count--;
  // -le ending counts as syllable
  if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) count++;

  return Math.max(1, count);
}

function sentenceCount(text: string): number {
  return Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
}

export function fleschKincaid(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  const sentences = sentenceCount(text);
  const syllables = words.reduce((sum, w) => sum + syllableCount(w), 0);

  // Flesch Reading Ease
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

// ── Heading structure ───────────────────────────────────────

function checkHeadingHierarchy(text: string): { valid: boolean; detail: string } {
  const headings = [...text.matchAll(/^(#{1,6})\s+.+$/gm)].map((m) => m[1].length);

  if (headings.length === 0) {
    return { valid: false, detail: "No headings found" };
  }

  // Check that first heading is H1 or H2
  if (headings[0] > 2) {
    return { valid: false, detail: `First heading is H${headings[0]}, expected H1 or H2` };
  }

  // Check no level skips (e.g. H2 → H4)
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      return { valid: false, detail: `Heading level jumps from H${headings[i - 1]} to H${headings[i]}` };
    }
  }

  return { valid: true, detail: `${headings.length} headings in proper hierarchy` };
}

// ── Paragraph length ────────────────────────────────────────

function longParagraphRatio(text: string): number {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return 0;

  const long = paragraphs.filter((p) => wordCount(p) > 150).length;
  return long / paragraphs.length;
}

// ── Uniqueness estimate (simple n-gram overlap) ─────────────

function trigramSet(text: string): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const set = new Set<string>();

  for (let i = 0; i <= words.length - 3; i++) {
    set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  return set;
}

export function trigramOverlap(textA: string, textB: string): number {
  const setA = trigramSet(textA);
  const setB = trigramSet(textB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const tri of setA) {
    if (setB.has(tri)) shared++;
  }

  return shared / Math.min(setA.size, setB.size);
}

// ── Grade helper ────────────────────────────────────────────

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

// ── Score a single content piece ────────────────────────────

export function scoreContent(
  entity: EntityRecord,
  content: string,
): ContentQualityResult {
  const checks: QualityCheck[] = [];
  let total = 0;

  // 1. Word count (20 pts) — aim for 300+
  const wc = wordCount(content);
  const wcScore = wc >= 300 ? 20 : wc >= 150 ? 12 : wc >= 50 ? 6 : 0;
  checks.push({
    label: "Word count (300+ target)",
    score: wcScore,
    maxScore: 20,
    passed: wcScore >= 12,
    detail: `${wc} words`,
  });
  total += wcScore;

  // 2. Readability (20 pts) — Flesch 40-70 is ideal for SEO
  const fk = fleschKincaid(content);
  const readScore = fk >= 40 && fk <= 70 ? 20 : fk >= 30 && fk <= 80 ? 14 : fk > 0 ? 8 : 0;
  checks.push({
    label: "Readability (Flesch 40-70)",
    score: readScore,
    maxScore: 20,
    passed: readScore >= 14,
    detail: `Flesch score: ${fk}`,
  });
  total += readScore;

  // 3. Heading structure (20 pts)
  const headingCheck = checkHeadingHierarchy(content);
  const headingScore = headingCheck.valid ? 20 : 5;
  checks.push({
    label: "Heading hierarchy",
    score: headingScore,
    maxScore: 20,
    passed: headingCheck.valid,
    detail: headingCheck.detail,
  });
  total += headingScore;

  // 4. Paragraph length (15 pts) — no walls of text
  const longRatio = longParagraphRatio(content);
  const paraScore = longRatio <= 0.1 ? 15 : longRatio <= 0.3 ? 10 : 5;
  checks.push({
    label: "Paragraph length (no walls of text)",
    score: paraScore,
    maxScore: 15,
    passed: paraScore >= 10,
    detail: `${Math.round(longRatio * 100)}% of paragraphs are 150+ words`,
  });
  total += paraScore;

  // 5. Title quality (15 pts)
  const title = entity.metadata.title ?? "";
  const titleLen = title.length;
  const titleKeywordFirst = entity.seedKeyword
    ? title.toLowerCase().startsWith(entity.seedKeyword.toLowerCase())
    : false;
  const titleScore =
    (titleLen >= 30 && titleLen <= 60 ? 8 : titleLen > 10 ? 4 : 0) +
    (titleKeywordFirst ? 7 : entity.seedKeyword && title.toLowerCase().includes(entity.seedKeyword.toLowerCase()) ? 4 : 0);
  checks.push({
    label: "Title quality (30-60 chars, keyword-first)",
    score: Math.min(titleScore, 15),
    maxScore: 15,
    passed: titleScore >= 10,
    detail: `${titleLen} chars${titleKeywordFirst ? ", keyword-first" : ""}`,
  });
  total += Math.min(titleScore, 15);

  // 6. Meta description (10 pts)
  const desc = entity.metadata.description ?? "";
  const descLen = desc.length;
  const descScore = descLen >= 120 && descLen <= 160 ? 10 : descLen >= 50 ? 6 : descLen > 0 ? 3 : 0;
  checks.push({
    label: "Meta description (120-160 chars)",
    score: descScore,
    maxScore: 10,
    passed: descScore >= 6,
    detail: `${descLen} chars`,
  });
  total += descScore;

  return {
    slug: entity.slug,
    name: entity.name,
    overallScore: total,
    grade: gradeFromScore(total),
    checks,
  };
}

// ── Score all entities ──────────────────────────────────────

export function scoreAllContent(
  entities: EntityRecord[],
  contentMap: Map<string, string>,
): QualityReport {
  const results = entities.map((entity) => {
    const content = contentMap.get(entity.slug) ?? "";
    return scoreContent(entity, content);
  });

  const avg =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length)
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    entityCount: results.length,
    averageScore: avg,
    averageGrade: gradeFromScore(avg),
    entities: results,
  };
}
