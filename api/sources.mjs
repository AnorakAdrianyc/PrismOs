/**
 * Vercel serverless handler for GET /api/sources.
 * Same report as the local server: Bank of Japan and ECB only.
 * The paper book does not use these feeds. No broker and no order route.
 */

import { buildSourceReport, failedSourceReport } from "../lib/sources.mjs";

const headers = { "cache-control": "no-store" };

export async function GET() {
  try {
    const report = await buildSourceReport();
    return Response.json(report, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("source report failed:", message);
    return Response.json(failedSourceReport(), { headers });
  }
}
