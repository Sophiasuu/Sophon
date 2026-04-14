import { readFile } from "node:fs/promises";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { writeGeneratedFile } from "./generate";
import { humanizeContent } from "./humanize";
import { log } from "./utils";
import type { EnrichOptions, EntityRecord } from "../types";

const MODEL = "claude-sonnet-4-20250514";
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

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

  if (!apiKey && !options.dryRun) {
    throw new Error("ANTHROPIC_API_KEY is required for enrichment. Use --dry-run to preview prompts without calling the API.");
  }

  const outputRoot = options.output ?? path.join("data", "enriched");
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  // Filter out already-enriched entities (cache check)
  const toEnrich: EntityRecord[] = [];
  for (const entity of options.entities) {
    const outputPath = path.join(outputRoot, entity.slug, "content.json");
    if (!options.force) {
      try {
        await readFile(outputPath, "utf8");
        console.log(`Cached: ${entity.slug} (use --force to re-enrich)`);
        continue;
      } catch (error) {
        log("debug", "enrich", `Cache miss for ${entity.slug}`, { path: outputPath, error: (error as Error).message });
      }
    }
    toEnrich.push(entity);
  }

  if (toEnrich.length === 0) {
    console.log("All entities already enriched. Use --force to re-enrich.");
    return;
  }

  // Dry-run mode: output prompts without calling API
  if (options.dryRun) {
    console.log(`Dry run: ${toEnrich.length} entities would be enriched\n`);
    for (const entity of toEnrich) {
      console.log(`--- ${entity.slug} ---`);
      console.log(`System prompt: (${SYSTEM_PROMPT.length} chars)`);
      console.log(`User prompt:\n${buildUserPrompt(entity)}\n`);
    }
    return;
  }

  const client = new Anthropic({ apiKey: apiKey! });

  console.log(`Enriching ${toEnrich.length} entities (${options.entities.length - toEnrich.length} cached, concurrency: ${concurrency})...`);

  // Process in concurrent batches
  let completed = 0;
  let failed = 0;

  async function enrichWithRetry(entity: EntityRecord, attempt: number): Promise<void> {
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

      const rawText = messageText(response as AnthropicMessageResponse);
      let raw: unknown;
      try {
        raw = JSON.parse(rawText);
      } catch (parseError) {
        log("error", "enrich", `Invalid JSON from Claude for ${entity.slug}`, {
          fragment: rawText.slice(0, 200),
          error: (parseError as Error).message,
        });
        throw new Error(`Invalid JSON response for ${entity.slug}: ${(parseError as Error).message}`);
      }

      // Apply humanization to content strings
      const humanized = humanizeContent(raw) as Record<string, unknown>;

      // Add enrichment timestamp
      humanized.enrichedAt = new Date().toISOString();

      await writeGeneratedFile(
        path.join(outputRoot, entity.slug, "content.json"),
        `${JSON.stringify(humanized, null, 2)}\n`,
        { force: options.force },
      );
      completed++;
      console.log(`  ✓ ${entity.slug} (${completed}/${toEnrich.length})`);
    } catch (error) {
      const isRetryable =
        error instanceof Error &&
        (/429|rate.limit|overloaded|500|502|503|529/i.test(error.message));

      if (isRetryable && attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`  ⟳ ${entity.slug}: retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return enrichWithRetry(entity, attempt + 1);
      }

      failed++;
      log("error", "enrich", `Enrichment failed for ${entity.slug}`, {
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`  ✗ ${entity.slug}:`, error instanceof Error ? error.message : error);
    }
  }

  // Concurrency pool
  const pool: Promise<void>[] = [];
  for (const entity of toEnrich) {
    const promise = enrichWithRetry(entity, 0);
    pool.push(promise);

    if (pool.length >= concurrency) {
      await Promise.race(pool);
      // Remove settled promises
      for (let i = pool.length - 1; i >= 0; i--) {
        const settled = await Promise.race([pool[i].then(() => true), Promise.resolve(false)]);
        if (settled) pool.splice(i, 1);
      }
    }
  }

  await Promise.all(pool);

  console.log(`Enrichment complete: ${completed} succeeded, ${failed} failed`);
}