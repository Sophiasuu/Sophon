import { classifyIntent } from "./intent";
import { gradeFromScore } from "./utils";
import type { EntityRecord, EntityScore, ScoreCheck, ScoreResult } from "../types";

function scoreEntity(entity: EntityRecord): EntityScore {
  const checks: ScoreCheck[] = [];
  let total = 0;

  const hasTitle = !!entity.metadata.title && entity.metadata.title.length > 10;
  checks.push({ label: "Title present and meaningful", points: hasTitle ? 20 : 0, maxPoints: 20, passed: hasTitle });
  total += hasTitle ? 20 : 0;

  const hasDesc = !!entity.metadata.description && entity.metadata.description.length > 20;
  checks.push({ label: "Description present and meaningful", points: hasDesc ? 20 : 0, maxPoints: 20, passed: hasDesc });
  total += hasDesc ? 20 : 0;

  const hasTags = (entity.metadata.tags?.length ?? 0) >= 1;
  checks.push({ label: "At least one tag", points: hasTags ? 10 : 0, maxPoints: 10, passed: hasTags });
  total += hasTags ? 10 : 0;

  const hasAttrs = Object.keys(entity.metadata.attributes ?? {}).length >= 1;
  checks.push({ label: "At least one attribute", points: hasAttrs ? 10 : 0, maxPoints: 10, passed: hasAttrs });
  total += hasAttrs ? 10 : 0;

  const cleanSlug = entity.slug.length > 0 && !entity.slug.includes("--") && entity.slug.length <= 80;
  checks.push({ label: "Clean URL-safe slug", points: cleanSlug ? 10 : 0, maxPoints: 10, passed: cleanSlug });
  total += cleanSlug ? 10 : 0;

  const { confidence } = classifyIntent(entity.name);
  const highConfidence = confidence >= 0.82;
  checks.push({ label: "High-confidence intent", points: highConfidence ? 15 : 5, maxPoints: 15, passed: highConfidence });
  total += highConfidence ? 15 : 5;

  const wordCount = entity.name.split(/\s+/).length;
  const specific = wordCount >= 3;
  checks.push({ label: "Specific entity name (3+ words)", points: specific ? 15 : 5, maxPoints: 15, passed: specific });
  total += specific ? 15 : 5;

  return {
    slug: entity.slug,
    name: entity.name,
    score: total,
    grade: gradeFromScore(total),
    checks,
  };
}

export function scoreEntities(entities: EntityRecord[]): ScoreResult {
  const scored = entities.map(scoreEntity);
  const avg = scored.length > 0
    ? Math.round(scored.reduce((sum, e) => sum + e.score, 0) / scored.length)
    : 0;

  return {
    entityCount: scored.length,
    averageScore: avg,
    averageGrade: gradeFromScore(avg),
    entities: scored,
  };
}
