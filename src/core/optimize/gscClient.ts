import { cacheGet, cacheSet } from "../cache";
import { log } from "../utils";
import type { GSCFetchOptions, GSCPageMetrics, GSCQueryRow, GSCResponse } from "../../types";

const GSC_API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";
const GSC_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (GSC data already 3-day lag)

function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 3); // GSC data has ~3-day lag
  const start = new Date(end);
  start.setDate(start.getDate() - 28);

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export async function fetchGSCData(options: GSCFetchOptions): Promise<GSCPageMetrics[]> {
  const accessToken = options.accessToken ?? process.env.GSC_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error(
      "GSC access token is required. Set GSC_ACCESS_TOKEN or pass --access-token.",
    );
  }

  const { startDate, endDate } = options.startDate && options.endDate
    ? { startDate: options.startDate, endDate: options.endDate }
    : defaultDateRange();

  const siteUrl = encodeURIComponent(options.site);
  const limit = options.limit ?? 500;

  // Check cache first
  const cacheKey = `${options.site}:${startDate}:${endDate}:${limit}`;
  const cached = await cacheGet<GSCPageMetrics[]>("gsc", cacheKey, GSC_CACHE_TTL_MS);
  if (cached) {
    console.log(`Using cached GSC data (${cached.length} pages)`);
    return cached;
  }

  // Fetch page-level metrics
  const pageRows = await queryGSC(siteUrl, accessToken, {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: limit,
  });

  const pages: GSCPageMetrics[] = [];

  for (const row of pageRows) {
    const pageUrl = row.keys[0];

    // Fetch top queries per page
    const queryRows = await queryGSC(siteUrl, accessToken, {
      startDate,
      endDate,
      dimensions: ["page", "query"],
      dimensionFilterGroups: [
        {
          filters: [
            { dimension: "page", operator: "equals", expression: pageUrl },
          ],
        },
      ],
      rowLimit: 20,
    });

    pages.push({
      page: pageUrl,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      topQueries: queryRows.map((qr) => ({
        keys: [qr.keys[1]],
        clicks: qr.clicks,
        impressions: qr.impressions,
        ctr: qr.ctr,
        position: qr.position,
      })),
    });
  }

  // Cache the result for future calls
  await cacheSet("gsc", cacheKey, pages, GSC_CACHE_TTL_MS);

  return pages;
}

async function queryGSC(
  siteUrl: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<GSCQueryRow[]> {
  const url = `${GSC_API_BASE}/sites/${siteUrl}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const isClientError = response.status >= 400 && response.status < 500;
    log("error", "gsc", `GSC API ${isClientError ? "client" : "server"} error`, {
      status: response.status,
      // Redact potential token leaks from error body
      body: text.slice(0, 500),
    });
    throw new Error(`GSC API error (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as GSCResponse;

  return (data.rows ?? []).map((row) => ({
    keys: row.keys,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: Math.round(row.position * 10) / 10,
  }));
}

/**
 * Build GSCPageMetrics from pre-loaded data (for testing or offline use).
 */
export function buildMetricsFromRows(rows: GSCQueryRow[]): GSCPageMetrics[] {
  const pageMap = new Map<string, GSCPageMetrics>();

  for (const row of rows) {
    const page = row.keys[0];
    const existing = pageMap.get(page);

    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.topQueries.push(row);
    } else {
      pageMap.set(page, {
        page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        topQueries: [row],
      });
    }
  }

  // Recalculate CTR for aggregated data
  for (const metrics of pageMap.values()) {
    metrics.ctr = metrics.impressions > 0
      ? metrics.clicks / metrics.impressions
      : 0;
  }

  return Array.from(pageMap.values());
}
