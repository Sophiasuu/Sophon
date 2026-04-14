---
name: enrich
description: "Enrich discovered entities with AI-generated content using Claude via the Anthropic SDK. Outputs structured JSON per entity for downstream use in page templates. Requires ANTHROPIC_API_KEY (or use --dry-run to preview prompts)."
user-invocable: true
argument-hint: "[--enrich-output <path>]"
---

Generate AI-assisted content JSON for each entity using Claude, ready for injection into page templates.

## MANDATORY PREPARATION

Invoke the `sophon` skill first. It contains the entity model, enrichment conventions, and the **Context Gathering Protocol**.

**Follow the protocol before doing any work:**
1. Check loaded instructions for a `## Sophon Project Context` section.
2. Check `.sophon.md` in the project root.
3. If neither exists, run `sophon teach` now — do NOT skip this step.

---

## Requirements

`ANTHROPIC_API_KEY` must be set in the environment (unless using `--dry-run`). Enrichment will be retried with exponential backoff on transient errors (429/500/502/503/529).

```bash
export ANTHROPIC_API_KEY=your_key_here
```

## Execution

```bash
npx @sophonn/sophon enrich

# Preview prompts without calling the API
npx @sophonn/sophon enrich --dry-run

# Custom output directory
npx @sophonn/sophon enrich --enrich-output ./data/enriched

# Specify entity source
npx @sophonn/sophon enrich --entities ./data/entities.json --enrich-output ./data/enriched
```

## Output

One JSON file per entity written to `data/enriched/` (or `--enrich-output`). Each file contains structured content fields that map to the `// TODO` sections in generated page templates. An `enrichedAt` timestamp is set for downstream freshness tracking.

## Error Handling

- **Exponential backoff retry** — automatically retries on 429/500/502/503/529 errors (default 3 retries, configurable via `--max-retries`)
- **Dry-run mode** — `--dry-run` outputs the system and user prompts without calling the API, useful for reviewing what would be sent
- If a single entity fails enrichment after all retries, log the error and continue — do not abort the batch.
- If `ANTHROPIC_API_KEY` is missing (and not dry-run), exit early with a clear message mentioning `--dry-run`.
- Do not fabricate enriched content if enrichment fails; leave `// TODO` markers visible.
- **Cache-aware** — skips already-enriched entities unless `--force` is passed.

## Programmatic API

```ts
import { enrich } from "@sophonn/sophon";

await enrich({
  entities: result.entities,
  output: "data/enriched",
  dryRun: false,     // set true to preview prompts without API calls
  maxRetries: 3,     // exponential backoff retry count
});
```

## After Enrichment

Wire the enriched JSON files into the generated page templates by reading them during build time or at request time, depending on the host framework's data fetching model.
