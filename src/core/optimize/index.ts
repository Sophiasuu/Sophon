import path from "node:path";

import { writeGeneratedFile } from "../generate";
import { fetchGSCData } from "./gscClient";
import { mapEntitiesToGSC, filterMappedEntities } from "./entityMapper";
import { analyzeAll } from "./analyzer";
import { applyAutoFixes } from "./optimizer";
import type { OptimizeOptions, OptimizationReport } from "../../types";

export { fetchGSCData, buildMetricsFromRows } from "./gscClient";
export { mapEntitiesToGSC, filterMappedEntities, filterUnmappedEntities } from "./entityMapper";
export { analyzeEntity, analyzeAll, calculateScore } from "./analyzer";
export { generateRecommendations } from "./recommender";
export { applyAutoFixes, isSophonFile } from "./optimizer";

export async function optimize(options: OptimizeOptions): Promise<OptimizationReport> {
  const { site, entities, limit, autoFix, output } = options;

  // Step 1: Fetch GSC data (or use provided data)
  console.log("Fetching GSC performance data...");
  const gscPages = options.gscData ?? await fetchGSCData({
    site,
    limit,
    accessToken: options.accessToken,
  });

  console.log(`Fetched metrics for ${gscPages.length} pages`);

  // Step 2: Map GSC pages to entities
  console.log("Mapping GSC data to entities...");
  const mapped = mapEntitiesToGSC(entities, gscPages, site);
  const withData = filterMappedEntities(mapped);
  console.log(`Mapped ${withData.length}/${entities.length} entities to GSC data`);

  // Step 3: Analyze all mapped entities
  console.log("Analyzing performance...");
  const results = analyzeAll(mapped);

  // Step 4: Build report
  const report = buildReport(site, entities.length, results);

  // Step 5: Write report
  const outputPath = output ?? path.join("data", "optimization-report.json");
  await writeGeneratedFile(
    outputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    { force: true },
  );
  console.log(`Optimization report written to ${outputPath}`);

  // Step 6: Optional auto-fix
  if (autoFix) {
    console.log("Applying auto-fixes...");
    const fixResults = await applyAutoFixes(results, entities, process.cwd());
    const totalApplied = fixResults.reduce((sum, r) => sum + r.applied.length, 0);
    const totalSkipped = fixResults.reduce((sum, r) => sum + r.skipped.length, 0);
    console.log(`Auto-fix: ${totalApplied} applied, ${totalSkipped} skipped`);
  }

  // Step 7: Summary output
  printSummary(report);

  return report;
}

function buildReport(
  site: string,
  totalEntities: number,
  results: import("../../types").EntityOptimizationResult[],
): OptimizationReport {
  const summary = {
    critical: results.filter((r) => r.priority === "critical").length,
    high: results.filter((r) => r.priority === "high").length,
    medium: results.filter((r) => r.priority === "medium").length,
    low: results.filter((r) => r.priority === "low").length,
    averageScore:
      results.length > 0
        ? Math.round(
            results.reduce((sum, r) => sum + r.optimizationScore, 0) /
              results.length,
          )
        : 0,
  };

  return {
    generatedAt: new Date().toISOString(),
    site,
    totalEntities,
    analyzedEntities: results.length,
    summary,
    entities: results,
  };
}

function printSummary(report: OptimizationReport): void {
  console.log(`\nOptimization Report Summary`);
  console.log(`  Site: ${report.site}`);
  console.log(`  Entities analyzed: ${report.analyzedEntities}/${report.totalEntities}`);
  console.log(`  Average score: ${report.summary.averageScore}/100`);
  console.log(`  Critical: ${report.summary.critical} | High: ${report.summary.high} | Medium: ${report.summary.medium} | Low: ${report.summary.low}`);

  const topIssues = report.entities
    .filter((e) => e.priority === "critical" || e.priority === "high")
    .slice(0, 5);

  if (topIssues.length > 0) {
    console.log(`\nTop priority entities:`);
    for (const entity of topIssues) {
      console.log(`  ${entity.slug}: score ${entity.optimizationScore}/100 (${entity.priority})`);
      for (const issue of entity.issues.slice(0, 2)) {
        console.log(`    - ${issue}`);
      }
    }
  }
}
