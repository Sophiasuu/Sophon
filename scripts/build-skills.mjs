#!/usr/bin/env node
/**
 * build-skills.mjs
 *
 * Distributes source/skills into provider-specific directories.
 *
 * Providers and their output dirs:
 *   claude-code  →  .claude/skills/
 *   agents       →  .agents/skills/   (VS Code Copilot Agents / GitHub Copilot)
 *   cursor       →  .cursor/skills/
 *   codex        →  .codex/skills/
 *
 * Each provider supports a different subset of YAML frontmatter fields.
 * This script strips unsupported fields per provider while keeping the
 * markdown body identical across all outputs.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE_DIR = join(ROOT, "source", "skills");

/**
 * Fields each provider supports in YAML frontmatter (beyond name + description).
 * Fields not listed are stripped.
 */
const PROVIDERS = {
  "claude-code": {
    configDir: ".claude",
    frontmatterFields: ["user-invocable", "argument-hint"],
  },
  agents: {
    configDir: ".agents",
    frontmatterFields: ["user-invocable", "argument-hint"],
  },
  cursor: {
    configDir: ".cursor",
    frontmatterFields: [],
  },
  codex: {
    configDir: ".codex",
    frontmatterFields: ["argument-hint"],
  },
};

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { frontmatter: Record<string, string>, body: string }.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2] };
}

/**
 * Serialize frontmatter fields back to YAML block.
 */
function serializeFrontmatter(fields) {
  const lines = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return `---\n${lines}\n---\n`;
}

/**
 * Build provider-specific SKILL.md content by keeping only allowed fields.
 */
function buildProviderContent(frontmatter, body, allowedFields) {
  const kept = {};
  for (const field of ["name", "description", ...allowedFields]) {
    if (frontmatter[field] !== undefined) {
      kept[field] = frontmatter[field];
    }
  }
  return serializeFrontmatter(kept) + body;
}

// Discover all source skills.
const skillNames = readdirSync(SOURCE_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

console.log(`Found ${skillNames.length} skills: ${skillNames.join(", ")}\n`);

for (const [providerKey, { configDir, frontmatterFields }] of Object.entries(PROVIDERS)) {
  const skillsDir = join(ROOT, configDir, "skills");
  let count = 0;

  for (const skill of skillNames) {
    const sourcePath = join(SOURCE_DIR, skill, "SKILL.md");
    const source = readFileSync(sourcePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(source);
    const output = buildProviderContent(frontmatter, body, frontmatterFields);

    const destDir = join(skillsDir, skill);
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "SKILL.md"), output, "utf8");
    count++;
  }

  console.log(`✓  ${providerKey.padEnd(12)} → ${configDir}/skills/  (${count} skills)`);
}

console.log("\nDone.");
