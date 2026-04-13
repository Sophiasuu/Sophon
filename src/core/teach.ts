import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { Framework } from "../types";

export type TeachAnswers = {
  niche: string;
  siteUrl: string;
  framework: string;
  contentGoal: string;
  targetAudience: string;
  differentiator: string;
  entitySource: string;
  aiEnrichment: string;
};

const VALID_FRAMEWORKS = ["nextjs", "astro", "nuxt", "sveltekit", "remix"];
const VALID_ENTITY_SOURCES = ["seed", "csv", "existing"];
const VALID_AI_ANSWERS = ["yes", "no", "pending"];

async function askQuestion(rl: ReturnType<typeof createInterface>, question: string, validator?: (answer: string) => boolean): Promise<string> {
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const answer = (await rl.question(question)).trim();

    if (!answer) {
      console.log("Please provide an answer.");
      continue;
    }

    if (validator && !validator(answer)) {
      console.log("Invalid answer. Please try again.");
      continue;
    }

    return answer;
  }

  throw new Error("Too many invalid attempts. Run `sophon teach` again.");
}

export function formatContext(answers: TeachAnswers): string {
  return `## Sophon Project Context

- **Niche**: ${answers.niche}
- **Site URL**: ${answers.siteUrl}
- **Framework**: ${answers.framework}
- **Content goal**: ${answers.contentGoal}
- **Target audience**: ${answers.targetAudience}
- **Differentiator**: ${answers.differentiator}
- **Entity source**: ${answers.entitySource}
- **AI enrichment**: ${answers.aiEnrichment}
`;
}

export async function teach(): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    console.log("I'll ask a few quick questions so Sophon can work properly with your project.\n");

    console.log("--- Group 1: Project basics ---\n");

    const niche = await askQuestion(
      rl,
      "1. What is the niche or topic you want to build a programmatic SEO surface for?\n   (e.g. \"best payroll software for small teams\")\n   > ",
    );

    const siteUrl = await askQuestion(
      rl,
      "\n2. What is your site's base URL? (e.g. https://mysite.com)\n   > ",
      (answer) => answer.startsWith("http://") || answer.startsWith("https://"),
    );

    const framework = await askQuestion(
      rl,
      `\n3. Which framework does your project use? (${VALID_FRAMEWORKS.join(", ")})\n   > `,
      (answer) => VALID_FRAMEWORKS.includes(answer.toLowerCase()),
    );

    console.log("\n--- Group 2: Content strategy ---\n");

    const contentGoal = await askQuestion(
      rl,
      "4. What is the goal of each generated page?\n   (e.g. rank for long-tail keywords, capture leads, drive free trial signups)\n   > ",
    );

    const targetAudience = await askQuestion(
      rl,
      "\n5. Who is your target audience?\n   (e.g. HR managers at SMBs, freelance designers, e-commerce store owners)\n   > ",
    );

    const differentiator = await askQuestion(
      rl,
      "\n6. What makes your offering different from what competitors rank for today?\n   > ",
    );

    console.log("\n--- Group 3: Technical setup ---\n");

    const entitySource = await askQuestion(
      rl,
      `7. How will you source entities? (${VALID_ENTITY_SOURCES.join(" / ")})\n   - seed: Sophon scaffolds entities from your niche\n   - csv: You provide a file with entity names and attributes\n   - existing: Use existing data/entities.json\n   > `,
      (answer) => VALID_ENTITY_SOURCES.includes(answer.toLowerCase()),
    );

    const aiEnrichment = await askQuestion(
      rl,
      `\n8. Do you have an ANTHROPIC_API_KEY for AI content enrichment? (${VALID_AI_ANSWERS.join(" / ")})\n   > `,
      (answer) => VALID_AI_ANSWERS.includes(answer.toLowerCase()),
    );

    const answers: TeachAnswers = {
      niche,
      siteUrl: siteUrl.replace(/\/$/, ""),
      framework: framework.toLowerCase(),
      contentGoal,
      targetAudience,
      differentiator,
      entitySource: entitySource.toLowerCase(),
      aiEnrichment: aiEnrichment.toLowerCase(),
    };

    const outputPath = path.join(process.cwd(), ".sophon.md");
    await writeFile(outputPath, formatContext(answers), "utf8");
    console.log(`\nContext saved to ${outputPath}`);
    console.log("Next step: use \`sophon discover\` to find entities, or \`sophon run\` to execute the full pipeline.");
  } finally {
    rl.close();
  }
}
