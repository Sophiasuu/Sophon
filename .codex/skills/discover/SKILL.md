---
name: discover
description: "Discover and normalize entities for programmatic SEO from a seed keyword or CSV file. Writes normalized entities to data/entities.json. Use when the user wants to find, import, or expand a list of SEO targets."
argument-hint: "[--seed <keyword> | --csv <path>]"
---

Turn a seed keyword or CSV file into normalized entities ready for page generation.

## MANDATORY PREPARATION

Invoke the `sophon` skill first. It contains the entity model, adapter map, operating rules, and the **Context Gathering Protocol**.

**Follow the protocol before doing any work:**
1. Check loaded instructions for a `## Sophon Project Context` section.
2. Check `.sophon.md` in the project root.
3. If neither exists, run `sophon teach` now — do NOT skip this step.

---

## Inputs

| Flag | Description |
|------|-------------|
| `--seed <keyword>` | Expand a niche into entity candidates |
| `--csv <path>` | Import entities from a CSV file |
| `--pattern <template>` | Custom expansion pattern (repeatable) |
| `--discover-output <path>` | Override default `data/entities.json` output |

When both `--seed` and `--csv` are provided, the CSV is the source of truth. The seed is used as enrichment context only.

## Execution

```bash
# From seed keyword
npx @sophonn/sophon discover --seed "best payroll software"

# Custom expansion patterns (prefer repeated --pattern over a single --patterns flag)
npx @sophonn/sophon discover \
  --seed "best payroll software" \
  --pattern "{seed} alternatives" \
  --pattern "{seed} pricing" \
  --pattern "best {seed}"

# From CSV
npx @sophonn/sophon discover --csv ./input/entities.csv
```

## Output

Discovery writes to `data/entities.json` by default (or `--discover-output` when provided).

Key guarantees:
- Entity IDs are **deterministic**: the same normalized name produces the same ID across runs.
- Extra CSV columns are preserved in `metadata.attributes` so downstream generation can use them.
- Tags and seed are preserved for internal linking by the `technical` step.

## Programmatic API

```ts
import { discover } from "@sophonn/sophon";

const result = await discover({ seed: "best payroll software" });
// result.entities: Entity[]
```

## After Discovery

Verify the output at `data/entities.json`, then run the `generate` skill to scaffold framework pages.
