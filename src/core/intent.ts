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
    pattern: /pricing|cost|price|plans|quote|buy|purchase|deals?|coupon|discount|free trial/i,
    priority: 92,
    confidence: 0.9,
    reason: "Strong buying-intent modifier detected.",
  },
  {
    intent: "comparison",
    pattern: /alternatives|comparison|vs\b|compare|versus|better than|switch(?:ing)?\s+from|replace|competitor/i,
    priority: 88,
    confidence: 0.86,
    reason: "Evaluation-intent modifier detected.",
  },
  {
    intent: "segmented",
    pattern: /for (?:startups|small business|enterprises|agencies|ecommerce|teams|freelancers|developers|designers|nonprofits|education|healthcare|real estate|saas|b2b|b2c|beginners|remote teams|solopreneurs)/i,
    priority: 80,
    confidence: 0.82,
    reason: "Audience-segment modifier detected.",
  },
  {
    intent: "commercial",
    pattern: /\b(?:best|top\s+\d+|top)\b/i,
    priority: 85,
    confidence: 0.83,
    reason: "Listicle/ranking modifier detected; strong commercial intent.",
  },
  {
    intent: "informational",
    pattern: /what is|how to|guide|checklist|template|tutorial|examples|definition|overview|explained|101|introduction|FAQ|learn/i,
    priority: 70,
    confidence: 0.75,
    reason: "Top-of-funnel informational modifier detected.",
  },
  {
    intent: "informational",
    pattern: /\breview(?:s|ed)?\b|\brating\b|\bopinion\b/i,
    priority: 72,
    confidence: 0.72,
    reason: "Review/opinion modifier detected; informational with commercial lean.",
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
