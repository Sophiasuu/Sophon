/**
 * Content humanization — post-process AI-generated text to remove
 * mechanical patterns, AI-isms, and formatting artifacts.
 *
 * v2: Context-aware substitution with collision prevention.
 * - Replacements check surrounding context before applying
 * - Transition removals use natural alternatives instead of empty strings
 * - Multi-pass collision detection prevents "Therefore, However, " artifacts
 */

// ── EM dash and typography normalization ────────────────────

const EM_DASH_RE = /\s*[—–]\s*/g;
const DOUBLE_HYPHEN_RE = /\s*--\s*/g;
const ELLIPSIS_RE = /\.{3,}/g;
const SMART_QUOTES_RE = /[\u201C\u201D]/g;
const SMART_SINGLE_RE = /[\u2018\u2019]/g;

// ── Context-aware replacement helper ────────────────────────
// Only applies a replacement if it wouldn't create awkward phrasing
// like double transitions ("Therefore, However, ") or orphaned punctuation

function contextAwareReplace(text: string, pattern: RegExp, replacement: string): string {
  return text.replace(pattern, (match, ...args) => {
    // args[-2] is offset, args[-1] is full string for non-capturing groups
    const offset = typeof args[args.length - 2] === "number" ? args[args.length - 2] as number : 0;
    const fullText = typeof args[args.length - 1] === "string" ? args[args.length - 1] as string : text;

    // If replacement is a transition word (e.g. "However, ") and the preceding
    // text already ends with a transition, skip the replacement to prevent collisions
    if (replacement && /^(However|Still|Yet|But),?\s*$/i.test(replacement)) {
      const before = fullText.slice(Math.max(0, offset - 30), offset);
      if (/(?:However|Still|Yet|But|Therefore|Thus|Hence|So|And|Or),?\s*$/i.test(before)) {
        return ""; // Drop the transition to avoid collision
      }
    }

    return replacement;
  });
}

// ── AI-ism phrase patterns ──────────────────────────────────
// Organized by category with context-aware replacements.
// Empty replacements now only used for genuine filler with no semantic content.
// Transition words get natural alternatives instead of deletion.

const AI_PHRASES: Array<{ pattern: RegExp; replacement: string; contextSafe?: boolean }> = [
  // Filler openers — safe to remove entirely (no semantic content)
  { pattern: /\bIn today'?s (?:fast-paced|digital|modern|ever-changing|rapidly evolving) (?:world|landscape|era|environment)\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bIt'?s worth noting that\s*/gi, replacement: "" },
  { pattern: /\bIt is worth noting that\s*/gi, replacement: "" },
  { pattern: /\bIt'?s important to (?:note|understand|remember|recognize) that\s*/gi, replacement: "" },
  { pattern: /\bIt is important to (?:note|understand|remember|recognize) that\s*/gi, replacement: "" },
  { pattern: /\bLet'?s dive (?:in|into|deeper)\b[.!]?\s*/gi, replacement: "" },
  { pattern: /\bLet us dive (?:in|into|deeper)\b[.!]?\s*/gi, replacement: "" },
  { pattern: /\bWithout further ado\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bIn this (?:article|guide|post|section),? we (?:will|'ll) (?:explore|discuss|cover|look at|examine|delve into)\b[.]?\s*/gi, replacement: "" },

  // Hedge phrases — safe to remove
  { pattern: /\bAt the end of the day\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bWhen all is said and done\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bAll things considered\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bIn the grand scheme of things\b[,.]?\s*/gi, replacement: "" },

  // Transition bloat — context-aware replacements to preserve flow
  { pattern: /\bThat being said\b[,.]?\s*/gi, replacement: "", contextSafe: true },
  { pattern: /\bHaving said that\b[,.]?\s*/gi, replacement: "", contextSafe: true },
  { pattern: /\bWith that in mind\b[,.]?\s*/gi, replacement: "", contextSafe: true },
  { pattern: /\bOn the other hand\b[,.]?\s*/gi, replacement: "However, ", contextSafe: true },
  { pattern: /\bMoreover\b[,.]?\s*/gi, replacement: "Also, " },
  { pattern: /\bFurthermore\b[,.]?\s*/gi, replacement: "Also, " },
  { pattern: /\bAdditionally\b[,.]?\s*/gi, replacement: "Also, " },
  { pattern: /\bNevertheless\b[,.]?\s*/gi, replacement: "Still, ", contextSafe: true },
  { pattern: /\bNonetheless\b[,.]?\s*/gi, replacement: "Still, ", contextSafe: true },

  // AI-typical vocabulary — context-aware word substitutions
  { pattern: /\bdelve(?:s|d)? (?:into|deeper)\b/gi, replacement: "covers" },
  { pattern: /\bdelve\b/gi, replacement: "explore" },
  { pattern: /\btap(?:s|ped)? into (?:the power|the potential)\b/gi, replacement: "uses" },
  { pattern: /\bleverage(?:s|d)?\b/gi, replacement: "use" },
  { pattern: /\butilize(?:s|d)?\b/gi, replacement: "use" },
  { pattern: /\bfacilitate(?:s|d)?\b/gi, replacement: "help" },
  { pattern: /\bseamless(?:ly)?\b/gi, replacement: "smooth" },
  { pattern: /\brobust\b/gi, replacement: "solid" },
  { pattern: /\bcutting-edge\b/gi, replacement: "modern" },
  { pattern: /\bgame-?changer\b/gi, replacement: "major improvement" },
  { pattern: /\bparadigm shift\b/gi, replacement: "significant change" },
  { pattern: /\bsynerg(?:y|ies|ize)\b/gi, replacement: "combination" },
  { pattern: /\bholistic(?:ally)?\b/gi, replacement: "complete" },

  // Conclusion markers — safe to remove
  { pattern: /\bIn conclusion\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bTo summarize\b[,.]?\s*/gi, replacement: "" },
  { pattern: /\bTo sum up\b[,.]?\s*/gi, replacement: "" },

  // Exclamation mark overuse (replace ! with . in most contexts)
  { pattern: /([a-z])!\s/g, replacement: "$1. " },
];

// ── Sentence-level cleanup ──────────────────────────────────

const LEADING_SPACE_RE = /^\s+/;
const MULTI_SPACE_RE = / {2,}/g;
const SENTENCE_START_RE = /(?:^|[.!?]\s+)([a-z])/g;

// ── Collision detection patterns ────────────────────────────
// Catches double transitions like "Therefore, However," or "Also, Also,"
const DOUBLE_TRANSITION_RE = /\b(However|Still|Yet|But|Also|So|And|Or|Thus|Hence|Therefore),?\s+(However|Still|Yet|But|Also|So|And|Or|Thus|Hence|Therefore),?\s*/gi;
const ORPHANED_PARENS_RE = /\(\s*\)/g;

function fixSentenceCase(text: string): string {
  return text.replace(SENTENCE_START_RE, (match) => match.toUpperCase());
}

function fixOrphanedPunctuation(text: string): string {
  return text
    .replace(/\s+([,.])/g, "$1")   // remove space before comma/period
    .replace(/,\s*,/g, ",")         // double commas
    .replace(/\.\s*\./g, ".")       // double periods
    .replace(/\s*\.\s*$/gm, ".");   // trailing period spacing
}

function fixCollisions(text: string): string {
  let result = text;

  // Remove double transitions — keep the second one
  result = result.replace(DOUBLE_TRANSITION_RE, (_match, _first, second) => {
    return `${second}, `;
  });

  // Remove orphaned parentheses
  result = result.replace(ORPHANED_PARENS_RE, "");

  return result;
}

// ── Main humanize function ──────────────────────────────────

export function humanize(text: string): string {
  let result = text;

  // Step 1: Typography normalization
  result = result.replace(EM_DASH_RE, " - ");
  result = result.replace(DOUBLE_HYPHEN_RE, " - ");
  result = result.replace(ELLIPSIS_RE, "...");
  result = result.replace(SMART_QUOTES_RE, '"');
  result = result.replace(SMART_SINGLE_RE, "'");

  // Step 2: Context-aware AI phrase replacement
  for (const { pattern, replacement, contextSafe } of AI_PHRASES) {
    if (contextSafe) {
      result = contextAwareReplace(result, pattern, replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }

  // Step 3: Fix transition collisions (must run before spacing cleanup)
  result = fixCollisions(result);

  // Step 4: Clean up spacing and punctuation artifacts
  result = result.replace(MULTI_SPACE_RE, " ");
  result = fixOrphanedPunctuation(result);
  result = result.replace(LEADING_SPACE_RE, "");

  // Step 5: Fix sentence case after removals
  result = fixSentenceCase(result);

  // Step 6: Trim lines
  result = result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  return result.trim();
}

/**
 * Humanize all string fields in a JSON content object recursively.
 */
export function humanizeContent(obj: unknown): unknown {
  if (typeof obj === "string") {
    return humanize(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(humanizeContent);
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = humanizeContent(value);
    }
    return result;
  }

  return obj;
}

/**
 * Count AI-ism occurrences for quality scoring purposes.
 */
export function countAiPatterns(text: string): number {
  let count = 0;
  count += (text.match(EM_DASH_RE) ?? []).length;
  for (const { pattern } of AI_PHRASES) {
    const globalPattern = new RegExp(pattern.source, "gi");
    count += (text.match(globalPattern) ?? []).length;
  }
  return count;
}
