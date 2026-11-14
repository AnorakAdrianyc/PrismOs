/**
 * Classroom paper book for the PrismOS lesson.
 *
 * The anchor is the whole-yen level named in the Mainichi article ("above 160"),
 * not a fetched quote. The shift is a round teaching constant so a reader can
 * recompute the result by hand. Neither number is a forecast.
 */

export const ARTICLE_THRESHOLD_YEN = 160;
export const CLASSROOM_SHIFT_YEN = -1;
export const NOTIONAL_USD = 10_000;
export const RULE_ID = "short-cover-reading";

/**
 * Build the labelled paper scenario. Takes no market data on purpose.
 * @returns {{
 *   pair: "USD/JPY",
 *   ruleId: string,
 *   thresholdYen: number,
 *   shiftYen: number,
 *   markYen: number,
 *   notionalUsd: number,
 *   pnlJpy: number,
 *   pnlUsd: number
 * }}
 */
export function paperScenario() {
  const markYen = ARTICLE_THRESHOLD_YEN + CLASSROOM_SHIFT_YEN;
  const pnlJpy = NOTIONAL_USD * (markYen - ARTICLE_THRESHOLD_YEN);
  const pnlUsd = pnlJpy / markYen;
  return {
    pair: "USD/JPY",
    ruleId: RULE_ID,
    thresholdYen: ARTICLE_THRESHOLD_YEN,
    shiftYen: CLASSROOM_SHIFT_YEN,
    markYen,
    notionalUsd: NOTIONAL_USD,
    pnlJpy,
    pnlUsd,
  };
}

/**
 * @param {number} amount
 * @returns {string}
 */
export function formatSignedYen(amount) {
  const sign = amount < 0 ? "−" : amount > 0 ? "+" : "";
  return `${sign}${Math.abs(amount).toLocaleString("en-US")} yen`;
}

/**
 * Round half-away-from-zero to the cent for display, using an explicit sign.
 * @param {number} amount
 * @returns {string}
 */
export function formatUsdCents(amount) {
  const cents = Math.round(Math.abs(amount) * 100);
  const sign = amount < 0 ? "−" : amount > 0 ? "+" : "";
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${sign}${whole.toLocaleString("en-US")}.${frac} USD`;
}
