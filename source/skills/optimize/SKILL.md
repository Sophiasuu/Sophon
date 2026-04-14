---
name: optimize
description: "Pull real performance data from Google Search Console, analyze weak-performing pages, and generate actionable optimization recommendations. Optionally applies safe auto-fixes to Sophon-generated content."
user-invocable: true
argument-hint: "[--site URL] [--limit N] [--auto-fix]"
---

## Overview

The `optimize` skill connects Sophon entities to real search performance data from Google Search Console (GSC). It identifies underperforming pages, diagnoses issues, and produces a prioritized optimization report with actionable recommendations.

## Prerequisites

- **GSC access token**: Set `GSC_ACCESS_TOKEN` environment variable or pass `--access-token`.
- **Entities**: A valid `data/entities.json` file (output of `sophon discover`).
- **Site URL**: The verified GSC property URL (e.g. `https://example.com`).

## CLI Usage

```bash
sophon optimize --site https://example.com
sophon optimize --site https://example.com --limit 50
sophon optimize --site https://example.com --auto-fix
sophon optimize --site https://example.com --access-token TOKEN --output ./report.json
```

### Options

| Flag | Description |
|------|-------------|
| `--site` | **(required)** GSC property URL |
| `--limit` | Max pages to fetch from GSC (default: 500) |
| `--auto-fix` | Apply safe auto-fixes to enriched content |
| `--access-token` | GSC OAuth access token (or set `GSC_ACCESS_TOKEN`) |
| `--output` | Output path (default: `data/optimization-report.json`) |
| `--entities` | Path to entities file (default: `data/entities.json`) |

## Pipeline

1. **Fetch** — Pull page-level and query-level metrics from GSC API
2. **Map** — Match GSC pages to Sophon entities by slug
3. **Analyze** — Apply rule-based detection for underperformance patterns
4. **Recommend** — Generate typed, actionable recommendations
5. **Report** — Write prioritized `optimization-report.json`
6. **Auto-fix** *(optional)* — Insert TODO markers into enriched content files

## Analysis Rules

| Pattern | Issue Type | Detection |
|---------|-----------|-----------|
| High impressions + low CTR | `low_ctr` / `high_impressions_low_clicks` | CTR below threshold for position range |
| Position 8–20 | `striking_distance` | Page is close to page 1 |
| Position >20 | `poor_position` | Significant content gap |
| Low impressions | `low_impressions` | Keyword mismatch or not indexed |
| Intent mismatch | `intent_mismatch` | Page structure doesn't match query intent |
| Weak internal linking | `weak_linking` | Few inbound internal links |

## Scoring

Each entity receives an **optimization score** (0–100):

- **Position**: 0–40 point penalty based on ranking
- **CTR**: Up to 25 point penalty for low click-through
- **Impressions**: Up to 20 point penalty for low visibility
- **Issue count**: Up to 15 point penalty

Priority mapping: `critical` (<30) | `high` (<50) | `medium` (<70) | `low` (≥70)

## Recommendation Types

| Type | Examples |
|------|---------|
| `meta` | Rewrite title, improve meta description |
| `content` | Add sections, expand content depth |
| `structure` | Add FAQ schema, restructure for intent |
| `linking` | Add internal links, build topic clusters |

## Auto-Fix Safety

When `--auto-fix` is enabled:
- Only modifies files within the project directory
- Only touches Sophon-generated files (files containing `SOPHON GENERATED` marker)
- Inserts `[OPTIMIZE]` TODO markers — does not overwrite existing content
- Falls back gracefully if enriched files don't exist

## Output Format

```json
{
  "generatedAt": "2026-04-13T...",
  "site": "https://example.com",
  "totalEntities": 100,
  "analyzedEntities": 87,
  "summary": {
    "critical": 5,
    "high": 12,
    "medium": 30,
    "low": 40,
    "averageScore": 62
  },
  "entities": [
    {
      "entity": "best payroll software for startups",
      "slug": "best-payroll-software-for-startups",
      "metrics": {
        "clicks": 120,
        "impressions": 4000,
        "ctr": 0.03,
        "position": 12.4
      },
      "optimizationScore": 42,
      "issues": ["Low CTR (3.0%) for position 12.4 — expected >1%"],
      "issueTypes": ["low_ctr", "striking_distance"],
      "recommendations": [
        {
          "type": "meta",
          "action": "Rewrite title tag — use power words, numbers, or brackets",
          "reasoning": "Low CTR relative to position indicates the title is not compelling."
        }
      ],
      "priority": "high"
    }
  ]
}
```

## Future Extensions

The optimize module is designed for extension:

- **Google Analytics**: Add bounce rate and session time as additional signals
- **A/B testing**: Generate title/meta variants and track performance
- **Continuous loop**: Schedule periodic optimization runs via cron
- **Entity discovery feedback**: Feed winning queries back into `sophon discover`
- **AI-enhanced recommendations**: Use Claude to rewrite titles/meta based on recommendations
