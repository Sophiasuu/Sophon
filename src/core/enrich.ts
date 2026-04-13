import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { writeGeneratedFile } from "./generate";
import type { EnrichOptions, EntityRecord } from "../types";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a programmatic SEO content generator.
Generate structured page content for the provided entity.

Rules you must follow:
- Only use facts explicitly present in the entity metadata
- Never invent statistics, prices, ratings, dates, or company facts
- Never make comparative claims without grounded data
- If you lack data for a section return a TODO marker instead of inventing content
- For YMYL topics (health, legal, financial, medical) add a disclaimer field
- Vary language meaningfully across entities to avoid duplicate content signals
- Never generate superlatives (best, fastest, cheapest) without sourced evidence

Return only valid JSON in this exact shape, no markdown, no preamble:
{
  "slug": "",
  "seo": {
    "title": "",
    "metaDescription": "",
    "canonicalPath": ""
  },
  "content": {
    "intro": "",
    "sections": [{ "heading": "", "body": "" }],
    "faqs": [{ "question": "", "answer": "" }],
    "comparisons": [{ "entity": "", "difference": "" }]
  },
  "schema": {
    "type": "WebPage",
    "name": "",
    "description": ""
  },
  "warnings": []
}`;

export type AnthropicMessageResponse = {
  content: Array<{
    type: string;
    text?: string;
  }>;
};

export function messageText(response: AnthropicMessageResponse): string {
  return response.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim();
}

export function buildUserPrompt(entity: EntityRecord): string {
  return JSON.stringify({ entity }, null, 2);
}

export async function enrich(options: EnrichOptions): Promise<void> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for enrichment.");
  }

  const outputRoot = options.output ?? path.join("data", "enriched");
  const client = new Anthropic({ apiKey });

  for (const entity of options.entities) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        stream: false,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(entity),
          },
        ],
      });

      const parsed = JSON.parse(messageText(response as AnthropicMessageResponse));
      await writeGeneratedFile(
        path.join(outputRoot, entity.slug, "content.json"),
        `${JSON.stringify(parsed, null, 2)}\n`,
      );
    } catch (error) {
      console.error(`Enrichment failed for ${entity.slug}:`, error instanceof Error ? error.message : error);
    }
  }
}