---
name: run
description: "Execute the full Sophon pipeline: discover → generate → technical → enrich. Use when the user wants to run all steps in one command or build a complete pSEO surface from scratch."
argument-hint: "[--seed <keyword> | --csv <path>] [--framework <name>] [--site <url>]"
user-invocable: true
---

Run the complete Sophon pipeline in a single command: discover entities, generate pages, produce technical SEO assets, and optionally enrich content.

## MANDATORY PREPARATION

Invoke the `sophon` skill first. It contains framework detection, entity model, operating rules, and the **Context Gathering Protocol**. Refer to the `discover`, `generate`, `technical`, and `enrich` skills for step-specific details.

**Follow the protocol before doing any work:**
1. Check loaded instructions for a `## Sophon Project Context` section.
2. Check `.sophon.md` in the project root.
3. If neither exists, run `sophon teach` now — do NOT skip this step.

---

## Execution

```bash
# Minimal — auto-detects framework
npx @sophonn/sophon run \
  --seed "best payroll software" \
  --site https://example.com

# Full with per-step output overrides
npx @sophonn/sophon run \
  --seed "best payroll software" \
  --framework sveltekit \
  --site https://example.com \
  --discover-output ./data/payroll-entities.json \
  --generate-output ./src/routes \
  --technical-output ./static \
  --enrich-output ./data/enriched
```

## Per-step Output Flags

Use step-specific flags when discovery, generation, technical assets, and enrichment need to land in different locations:

| Flag | Overrides |
|------|-----------|
| `--discover-output` | Where entities JSON is written |
| `--generate-output` | Page output root |
| `--technical-output` | Sitemap/robots/schema root |
| `--enrich-output` | Enriched content directory |

`--output` works for single-command flows but prefer per-step flags in `run` for clarity.

## From CSV

```bash
npx @sophonn/sophon run \
  --csv ./input/entities.csv \
  --framework nextjs \
  --site https://example.com
```

## Success Criteria

The pipeline is complete when:

- `data/entities.json` (or `--discover-output`) contains normalized entities
- Framework-appropriate static pages exist for each entity
- `sitemap.xml`, `robots.txt`, `public/sophon/schema.json`, and `public/sophon/internal-links.json` are generated
- All `// TODO` sections are visible in generated output for team review
- Generation warnings and output summaries are logged clearly

## Programmatic API

```ts
import { discover, generate, technical, enrich } from "@sophonn/sophon";

const result = await discover({ seed: "best payroll software" });

await generate({
  entities: result.entities,
  framework: "nextjs",
  output: "app",
});

await technical({
  entities: result.entities,
  site: "https://example.com",
  output: "public",
});

await enrich({
  entities: result.entities,
  output: "data/enriched",
});
```
