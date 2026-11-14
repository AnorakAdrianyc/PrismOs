import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASSROOM_SHIFT_YEN,
  NOTIONAL_USD,
  formatSignedYen,
  formatUsdCents,
  paperScenario,
} from "../public/paper-scenario.js";

test("paper scenario is a fixed classroom rule with no market input", () => {
  assert.equal(paperScenario.length, 0);
  const book = paperScenario();
  assert.equal(book.pair, "USD/JPY");
  assert.equal(book.ruleId, "short-cover-reading");
  assert.equal(book.thresholdYen, 160);
  assert.equal(book.shiftYen, CLASSROOM_SHIFT_YEN);
  assert.equal(book.markYen, 159);
  assert.equal(book.notionalUsd, NOTIONAL_USD);
  assert.equal(book.pnlJpy, -10_000);
  assert.equal(book.pnlUsd, -10_000 / 159);
});

test("display helpers keep the sign and the cent rounding", () => {
  const book = paperScenario();
  assert.equal(formatSignedYen(book.pnlJpy), "−10,000 yen");
  assert.equal(formatUsdCents(book.pnlUsd), "−62.89 USD");
});
