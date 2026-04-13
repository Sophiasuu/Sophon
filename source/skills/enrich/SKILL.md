---
name: enrich
description: "Enrich discovered entities with AI-generated content using Claude via the Anthropic SDK. Outputs structured JSON per entity for downstream use in page templates. Requires ANTHROPIC_API_KEY."
argument-hint: "[--enrich-output <path>]"
user-invocable: true
---

Generate AI-assisted content JSON for each entity using Claude, ready for injection into page templates.

## MANDATORY PREPARATION

Invoke the `sophon` skill first for entity model context.

---

## Requirements

`ANTHROPIC_API_KEY` must be set in the environment. Enrichment will be skipped (with a logged error) for any entity where the API call fails — the overall workflow continues.

```bash
export ANTHROPIC_API_KEY=your_key_here
```

## Execution

```bash
npx @sophonn/sophon enrich

# Custom output directory
npx @sophonn/sophon enrich --enrich-output ./data/enriched

# Specify entity source
npx @sophonn/sophon enrich --entities ./data/entities.json --enrich-output ./data/enriched
```

## Output

One JSON file per entity written to `data/enriched/` (or `--enrich-output`). Each file contains structured content fields that map to the `// TODO` sections in generated page templates.

## Error Handling

- If a single entity fails enrichment, log the error and continue — do not abort the batch.
- If `ANTHROPIC_API_KEY` is missing, exit early with a clear message.
- Do not fabricate enriched content if enrichment fails; leave `// TODO` markers visible.

## Programmatic API

```ts
import { enrich } from "@sophonn/sophon";

await enrich({
  entities: result.entities,
  output: "data/enriched",
});
```

## After Enrichment

Wire the enriched JSON files into the generated page templates by reading them during build time or at request time, depending on the host framework's data fetching model.
