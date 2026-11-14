import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../api/sources.mjs";

test("the Vercel handler returns an empty gap report when both official feeds throw", async () => {
  const original = globalThis.fetch;
  /** @type {string[]} */
  const called = [];
  globalThis.fetch = async (url) => {
    called.push(String(url));
    throw new Error("offline");
  };
  try {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.paperBookUsesFeeds, false);
    assert.equal(body.boj.status, "gap");
    assert.deepEqual(body.boj.points, []);
    assert.equal(body.ecb.status, "gap");
    assert.deepEqual(body.ecb.points, []);
    assert.equal(body.interactiveBrokers.called, false);
    assert.equal(body.tradingview.calledForQuote, false);
    assert.ok(called.every((href) => /boj\.or\.jp|ecb\.europa\.eu/.test(href)));
  } finally {
    globalThis.fetch = original;
  }
});
