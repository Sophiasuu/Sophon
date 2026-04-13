import type { ProposedEntityAction, ProposedEntityIntent } from "../types";

export type IntentClassification = {
  intent: ProposedEntityIntent;
  priority: number;
  confidence: number;
  reason: string;
  action: ProposedEntityAction;
};

const INTENT_RULES: Array<{
  intent: ProposedEntityIntent;
  pattern: RegExp;
  priority: number;
  confidence: number;
  reason: string;
}> = [
  {
    intent: "commercial",
    pattern: /pricing|cost|price|plans|quote|buy|purchase/i,
    priority: 92,
    confidence: 0.9,
    reason: "Strong buying-intent modifier detected.",
  },
  {
    intent: "comparison",
    pattern: /alternatives|comparison|vs\b|compare|versus/i,
    priority: 88,
    confidence: 0.86,
    reason: "Evaluation-intent modifier detected.",
  },
  {
    intent: "segmented",
    pattern: /for startups|for small business|for enterprises|for agencies|for ecommerce|for teams/i,
    priority: 80,
    confidence: 0.82,
    reason: "Audience-segment modifier detected.",
  },
  {
    intent: "informational",
    pattern: /what is|how to|guide|checklist|template|tutorial|examples/i,
    priority: 70,
    confidence: 0.75,
    reason: "Top-of-funnel informational modifier detected.",
  },
];

export function classifyIntent(name: string): IntentClassification {
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(name)) {
      return {
        intent: rule.intent,
        priority: rule.priority,
        confidence: rule.confidence,
        reason: rule.reason,
        action: rule.priority >= 85 ? "keep" : "review",
      };
    }
  }

  return {
    intent: "informational",
    priority: 65,
    confidence: 0.68,
    reason: "No explicit high-intent modifier detected; keep for topical coverage.",
    action: "review",
  };
}
