import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const FILES = [
  "README.md",
  "public/index.html",
  "public/app.js",
  "public/paper-scenario.js",
  "lib/sources.mjs",
  "server.mjs",
];

const LESSON_FILES = ["public/index.html", "public/app.js", "public/paper-scenario.js"];

const REQUIRED = [
  "https://mainichi.jp/english/articles/20261113/p2g/00m/0bu/048000c",
  "Japan to take appropriate action to stem yen slide if required: Katayama",
  "November 13, 2026",
  "FXERD04",
  "data-api.ecb.europa.eu",
  "Interactive Brokers",
  "TradingView",
  "paper",
];

const FORBIDDEN = [
  /you should buy/i,
  /you should sell/i,
  /buy now/i,
  /sell now/i,
  /go live/i,
  /target price/i,
  /place an order/i,
  /place orders/i,
  /beat the market/i,
  /guaranteed/i,
  /brokerage password/i,
];

test("public copy names the real source and stays inside the sandbox", async () => {
  const blobs = await Promise.all(
    FILES.map(async (file) => [file, await readFile(new URL(`../${file}`, import.meta.url), "utf8")]),
  );
  const combined = blobs.map(([, text]) => text).join("\n");
  for (const needle of REQUIRED) {
    assert.ok(combined.includes(needle), `missing ${needle}`);
  }
  for (const [file, text] of blobs) {
    if (!LESSON_FILES.includes(file)) continue;
    for (const pattern of FORBIDDEN) {
      assert.equal(pattern.test(text), false, `${file} matched ${pattern}`);
    }
  }
});
