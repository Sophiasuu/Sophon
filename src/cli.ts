#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parseArgs } from "node:util";

import { discover } from "./core/discover";
import { enrich } from "./core/enrich";
import { generate, writeGeneratedFile } from "./core/generate";
import { technical } from "./core/technical";
import { audit } from "./core/audit";
import { propose } from "./core/propose";
import { scoreEntities } from "./core/score";
import { teach } from "./core/teach";
import type { DiscoverResult, Framework } from "./types";

type SophonConfig = {
  framework: Framework;
  entitiesPath: string;
  pagesOutput: string;
  technicalOutput: string;
  enrichOutput: string;
};

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(values: Array<string | boolean> | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === "string");
}

function parseCli() {
  return parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      seed: { type: "string" },
      csv: { type: "string" },
      output: { type: "string" },
      entities: { type: "string" },
      "discover-output": { type: "string" },
      "generate-output": { type: "string" },
      "technical-output": { type: "string" },
      "enrich-output": { type: "string" },
      "propose-output": { type: "string" },
      pattern: { type: "string", multiple: true },
      patterns: { type: "string", multiple: true },
      limit: { type: "string" },
      framework: { type: "string" },
      template: { type: "string" },
      site: { type: "string" },
      "title-template": { type: "string" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
}

function defaultOutputRoot(framework: Framework): string {
  switch (framework) {
    case "nextjs":
      return "app";
    case "astro":
      return path.join("src", "pages");
    case "nuxt":
      return "pages";
    case "sveltekit":
      return path.join("src", "routes");
    case "remix":
      return path.join("app", "routes");
  }
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function detectFramework(): Promise<Framework | undefined> {
  const packageJson = await readJsonIfExists(path.join(process.cwd(), "package.json"));
  const dependencies = {
    ...(packageJson?.dependencies as Record<string, string> | undefined),
    ...(packageJson?.devDependencies as Record<string, string> | undefined),
  };

  if (dependencies.next) {
    return "nextjs";
  }

  if (dependencies.astro) {
    return "astro";
  }

  if (dependencies.nuxt) {
    return "nuxt";
  }

  if (dependencies["@sveltejs/kit"]) {
    return "sveltekit";
  }

  if (dependencies["@remix-run/react"] || dependencies["@remix-run/node"]) {
    return "remix";
  }

  return undefined;
}

const VALID_FRAMEWORKS = ["nextjs", "astro", "nuxt", "sveltekit", "remix"];

async function promptFramework(): Promise<Framework> {
  const rl = createInterface({ input, output });

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const answer = await rl.question("Select a framework (nextjs, astro, nuxt, sveltekit, remix): ");
      const framework = answer.trim().toLowerCase();

      if (VALID_FRAMEWORKS.includes(framework)) {
        return framework as Framework;
      }

      console.log("Invalid framework. Please try again.");
    }

    throw new Error("Too many invalid attempts. Use --framework to specify.");
  } finally {
    rl.close();
  }
}

async function resolveFramework(value?: string): Promise<Framework> {
  if (value) {
    return value as Framework;
  }

  const config = await readConfig();

  if (config?.framework) {
    return config.framework;
  }

  return (await detectFramework()) ?? promptFramework();
}

async function readConfig(): Promise<SophonConfig | undefined> {
  const config = await readJsonIfExists(path.join(process.cwd(), "sophon.config.json"));

  return config as SophonConfig | undefined;
}

async function loadDiscoverResult(filePath: string): Promise<DiscoverResult> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as DiscoverResult;
}

async function initCommand(values: ReturnType<typeof parseCli>["values"]): Promise<void> {
  const framework = await resolveFramework(asString(values.framework));
  const config: SophonConfig = {
    framework,
    entitiesPath: path.join("data", "entities.json"),
    pagesOutput: defaultOutputRoot(framework),
    technicalOutput: "public",
    enrichOutput: path.join("data", "enriched"),
  };

  await writeGeneratedFile(
    path.join(process.cwd(), "sophon.config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

async function discoverCommand(values: ReturnType<typeof parseCli>["values"]): Promise<DiscoverResult> {
  const result = await discover({
    csv: asString(values.csv),
    seed: asString(values.seed),
    output: asString(values["discover-output"]) ?? asString(values.output),
    titleTemplate: asString(values["title-template"]),
    patterns: [...asStringArray(values.pattern), ...asStringArray(values.patterns)],
  });

  const outputPath = asString(values["discover-output"]) ?? asString(values.output) ?? path.join("data", "entities.json");
  await writeGeneratedFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function proposeCommand(values: ReturnType<typeof parseCli>["values"]): Promise<void> {
  const seed = asString(values.seed);

  if (!seed) {
    throw new Error("--seed is required for the propose command.");
  }

  const result = propose({
    seed,
    patterns: [...asStringArray(values.pattern), ...asStringArray(values.patterns)],
    limit: Number.parseInt(asString(values.limit) ?? "", 10) || undefined,
  });

  const outputPath =
    asString(values["propose-output"]) ?? asString(values.output) ?? path.join("data", "proposed-entities.json");
  await writeGeneratedFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
    force: Boolean(values.force),
  });

  console.log(`proposed entities -> ${result.totalProposed}`);
  console.log(`intent mix -> ${JSON.stringify(result.groupedByIntent)}`);
}

async function generateCommand(values: ReturnType<typeof parseCli>["values"]): Promise<void> {
  const config = await readConfig();
  const entitiesPath = asString(values.entities) ?? config?.entitiesPath ?? path.join("data", "entities.json");
  const payload = await loadDiscoverResult(entitiesPath);
  const framework = await resolveFramework(asString(values.framework));

  await generate({
    entities: payload.entities,
    framework,
    output: asString(values["generate-output"]) ?? asString(values.output) ?? config?.pagesOutput,
    template: asString(values.template),
    force: Boolean(values.force),
  });
}

async function technicalCommand(values: ReturnType<typeof parseCli>["values"]): Promise<void> {
  const config = await readConfig();
  const entitiesPath = asString(values.entities) ?? config?.entitiesPath ?? path.join("data", "entities.json");
  const payload = await loadDiscoverResult(entitiesPath);
  const site = asString(values.site);

  if (!site) {
    throw new Error("--site is required for the technical command.");
  }

  await technical({
    entities: payload.entities,
    site,
    output: asString(values["technical-output"]) ?? asString(values.output) ?? config?.technicalOutput,
    force: Boolean(values.force),
  });
}

async function enrichCommand(values: ReturnType<typeof parseCli>["values"]): Promise<void> {
  const config = await readConfig();
  const entitiesPath = asString(values.entities) ?? config?.entitiesPath ?? path.join("data", "entities.json");
  const payload = await loadDiscoverResult(entitiesPath);

  await enrich({
    entities: payload.entities,
    output: asString(values["enrich-output"]) ?? asString(values.output) ?? config?.enrichOutput,
  });
}

async function runCommand(values: ReturnType<typeof parseCli>["values"]): Promise<void> {
  const config = await readConfig();
  const framework = await resolveFramework(asString(values.framework));
  const discoverOutput = asString(values["discover-output"]) ?? asString(values.output) ?? config?.entitiesPath ?? path.join("data", "entities.json");
  const generateOutput = asString(values["generate-output"]) ?? config?.pagesOutput ?? defaultOutputRoot(framework);
  const technicalOutput = asString(values["technical-output"]) ?? config?.technicalOutput ?? "public";
  const enrichOutput = asString(values["enrich-output"]) ?? config?.enrichOutput ?? path.join("data", "enriched");

  console.log("Running discover...");
  const result = await discover({
    csv: asString(values.csv),
    seed: asString(values.seed),
    output: discoverOutput,
    titleTemplate: asString(values["title-template"]),
    patterns: [...asStringArray(values.pattern), ...asStringArray(values.patterns)],
  });
  await writeGeneratedFile(discoverOutput, `${JSON.stringify(result, null, 2)}\n`);

  console.log("Running generate...");
  await generate({
    entities: result.entities,
    framework,
    output: generateOutput,
    template: asString(values.template),
    force: Boolean(values.force),
  });

  const site = asString(values.site);

  if (!site) {
    throw new Error("--site is required for the run command.");
  }

  console.log("Running technical...");
  await technical({
    entities: result.entities,
    site,
    output: technicalOutput,
    force: Boolean(values.force),
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("Skipping enrich: ANTHROPIC_API_KEY is not set.");
    return;
  }

  console.log("Running enrich...");
  await enrich({
    entities: result.entities,
    output: enrichOutput,
  });
}

async function auditCommand(): Promise<void> {
  await audit();
}

async function scoreCommand(values: ReturnType<typeof parseCli>["values"]): Promise<void> {
  const config = await readConfig();
  const entitiesPath = asString(values.entities) ?? config?.entitiesPath ?? path.join("data", "entities.json");
  const payload = await loadDiscoverResult(entitiesPath);

  const result = scoreEntities(payload.entities);

  const outputPath = asString(values.output) ?? path.join("data", "scores.json");
  await writeGeneratedFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
    force: Boolean(values.force),
  });

  console.log(`Entity health score: ${result.averageScore}/100 (${result.averageGrade})`);
  console.log(`Scored ${result.entityCount} entities`);

  const lowScoring = result.entities.filter((e) => e.score < 60);
  if (lowScoring.length > 0) {
    console.log(`\nEntities needing attention (${lowScoring.length}):`);
    for (const entity of lowScoring.slice(0, 10)) {
      console.log(`  ${entity.slug}: ${entity.score}/100 (${entity.grade})`);
    }
  }
}

function printHelp(): void {
  console.log(`sophon <command>

Commands:
  sophon init
  sophon teach
  sophon discover --seed "keyword" | --csv ./file.csv
  sophon propose --seed "keyword"
  sophon generate --framework nextjs
  sophon technical --site https://example.com
  sophon enrich
  sophon run --seed "keyword" --framework nextjs --site https://example.com
  sophon audit
  sophon score

Common flags:
  --entities <path>
  --discover-output <path>
  --propose-output <path>
  --generate-output <path>
  --technical-output <path>
  --enrich-output <path>
  --limit <number>
  --force`);
}

async function main(): Promise<void> {
  const parsed = parseCli();
  const command = parsed.positionals[0];

  if (parsed.values.help || !command) {
    printHelp();
    return;
  }

  switch (command) {
    case "init":
      await initCommand(parsed.values);
      return;
    case "teach":
      await teach();
      return;
    case "discover":
      await discoverCommand(parsed.values);
      return;
    case "propose":
      await proposeCommand(parsed.values);
      return;
    case "generate":
      await generateCommand(parsed.values);
      return;
    case "technical":
      await technicalCommand(parsed.values);
      return;
    case "enrich":
      await enrichCommand(parsed.values);
      return;
    case "run":
      await runCommand(parsed.values);
      return;
    case "audit":
      await auditCommand();
      return;
    case "score":
      await scoreCommand(parsed.values);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});