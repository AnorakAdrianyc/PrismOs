/**
 * Local static server for the PrismOS lesson.
 * Serves the page and one same-origin report of official reference rates.
 * Fixed hosts only: Bank of Japan and the European Central Bank. No open proxy,
 * no Interactive Brokers, no TradingView quote request, no order route.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSourceReport } from "./lib/sources.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

/** @type {{ at: number, report: object } | null} */
let cache = null;

/**
 * @param {string} urlPath
 * @returns {string | null}
 */
function fileFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const full = path.resolve(publicDir, rel);
  if (full !== publicDir && !full.startsWith(publicDir + path.sep)) return null;
  return full;
}

async function sourceReport() {
  const now = Date.now();
  if (cache && now - cache.at < 60_000) return cache.report;
  const report = await buildSourceReport();
  const usable = report.boj?.status === "ok" || report.ecb?.status === "ok";
  if (usable) cache = { at: now, report };
  return report;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end("Method not allowed");
    return;
  }

  if (url.pathname === "/api/sources") {
    try {
      const report = await sourceReport();
      const body = JSON.stringify(report);
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("source report failed:", message);
      const body = JSON.stringify({
        fetchedAt: new Date().toISOString(),
        paperBookUsesFeeds: false,
        boj: {
          status: "gap",
          message: "The reference report failed before a Bank of Japan figure was read. No rate was filled in.",
          points: [],
        },
        ecb: {
          status: "gap",
          message: "The reference report failed before an ECB figure was read. No cross was filled in.",
          points: [],
        },
      });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : body);
    }
    return;
  }

  const filePath = fileFor(url.pathname);
  if (!filePath) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad path");
    return;
  }

  try {
    const data = await readFile(filePath);
    const type = TYPES[path.extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`PrismOS paper sandbox at http://127.0.0.1:${port}`);
  console.log("Educational only. No orders. No deposits.");
});
