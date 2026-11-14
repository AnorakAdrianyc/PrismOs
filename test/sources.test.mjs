import assert from "node:assert/strict";
import test from "node:test";
import {
  ARTICLE_DATE,
  asNumber,
  bojMonthWindow,
  bojObservations,
  buildSourceReport,
  crossUsdJpy,
  ecbLeg,
  parseCsv,
  rowsToRecords,
} from "../lib/sources.mjs";

const USD_CSV = [
  "CURRENCY,CURRENCY_DENOM,TIME_PERIOD,OBS_VALUE,TITLE",
  "USD,EUR,2026-11-12,1.1081,\"US dollar/Euro, 2:15 pm\"",
  "USD,EUR,2026-11-13,1.1052,\"US dollar/Euro ECB reference exchange rate\"",
  "GBP,EUR,2026-11-13,0.8700,\"should be ignored\"",
].join("\n");

const JPY_CSV = [
  "CURRENCY,CURRENCY_DENOM,TIME_PERIOD,OBS_VALUE,TITLE",
  "JPY,EUR,2026-11-11,177.18,\"Japanese yen/Euro\"",
  "JPY,EUR,2026-11-12,176.96,\"Japanese yen/Euro\"",
  "JPY,EUR,2026-11-13,176.83,\"Japanese yen/Euro\"",
].join("\n");

function bojPayload(points) {
  return {
    STATUS: 200,
    RESULTSET: [
      {
        SERIES_CODE: "FXERD04",
        NAME_OF_TIME_SERIES: "US.Dollar/Yen Spot Rate at 17:00 in JST, Tokyo Market",
        UNIT: "Yen per U.S. Dollar",
        LAST_UPDATE: 20261113,
        VALUES: {
          SURVEY_DATES: points.map((point) => Number(point.date.replaceAll("-", ""))),
          VALUES: points.map((point) => point.value),
        },
      },
    ],
  };
}

test("csv parser keeps commas that sit inside quotes", () => {
  const records = rowsToRecords(parseCsv(USD_CSV));
  assert.equal(records[0].TITLE, "US dollar/Euro, 2:15 pm");
  assert.equal(records.length, 3);
});

test("parsers drop blanks and refuse to invent a shared date", () => {
  assert.equal(asNumber("NA"), null);
  assert.equal(asNumber(""), null);
  const observations = bojObservations({
    VALUES: {
      SURVEY_DATES: [20261111, 20261112, 20261113],
      VALUES: [158.88, null, "ND"],
    },
  });
  assert.deepEqual(observations, [{ date: "2026-11-11", value: 158.88 }]);

  const usd = ecbLeg(rowsToRecords(parseCsv(USD_CSV)), "USD");
  const jpy = ecbLeg(rowsToRecords(parseCsv(JPY_CSV)), "JPY");
  const crossed = crossUsdJpy(usd, jpy);
  assert.deepEqual(
    crossed.map((point) => point.date),
    ["2026-11-12", "2026-11-13"],
  );
  assert.ok(Math.abs(crossed[1].yenPerDollar - 176.83 / 1.1052) < 1e-12);
});

test("month window is rolling and zero-padded", () => {
  assert.deepEqual(bojMonthWindow(new Date("2026-11-14T12:00:00Z")), {
    startDate: "202609",
    endDate: "202611",
  });
});

test("report uses BOJ and ECB and never calls a broker or TradingView", async () => {
  /** @type {string[]} */
  const called = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    called.push(href);
    if (/interactivebrokers|tradingview/i.test(href)) {
      throw new Error(`refusing unexpected host ${href}`);
    }
    if (href.includes("stat-search.boj.or.jp")) {
      const body = JSON.stringify(
        bojPayload([
          { date: "2026-11-10", value: 158.02 },
          { date: "2026-11-11", value: 158.88 },
          { date: "2026-11-12", value: null },
        ]),
      );
      return new Response(body, { status: 200 });
    }
    if (href.includes("D.USD.EUR")) return new Response(USD_CSV, { status: 200 });
    if (href.includes("D.JPY.EUR")) return new Response(JPY_CSV, { status: 200 });
    throw new Error(`unexpected url ${href}`);
  };

  const report = await buildSourceReport({
    fetchImpl,
    now: new Date("2026-11-14T00:00:00Z"),
  });

  assert.equal(report.paperBookUsesFeeds, false);
  assert.equal(report.boj.status, "ok");
  assert.equal(report.boj.hasArticleDate, false);
  assert.equal(report.boj.latest.date, "2026-11-11");
  assert.equal(report.boj.latest.value, 158.88);
  assert.equal(report.boj.articleDate, ARTICLE_DATE);
  assert.equal(report.ecb.status, "ok");
  assert.equal(report.ecb.hasArticleDate, true);
  assert.equal(report.tradingview.calledForQuote, false);
  assert.equal(report.interactiveBrokers.called, false);
  assert.ok(called.every((href) => /boj\.or\.jp|ecb\.europa\.eu/.test(href)));
  assert.equal(called.length, 3);
});

test("a failed official feed stays a gap and does not borrow the other feed", async () => {
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("stat-search.boj.or.jp")) return new Response("nope", { status: 503 });
    if (href.includes("D.USD.EUR")) return new Response(USD_CSV, { status: 200 });
    if (href.includes("D.JPY.EUR")) return new Response("", { status: 500 });
    throw new Error(`unexpected url ${href}`);
  };

  const report = await buildSourceReport({ fetchImpl, now: new Date("2026-11-14T00:00:00Z") });
  assert.equal(report.boj.status, "gap");
  assert.deepEqual(report.boj.points, []);
  assert.match(report.boj.message, /HTTP 503/);
  assert.equal(report.ecb.status, "gap");
  assert.deepEqual(report.ecb.points, []);
  assert.match(report.ecb.message, /No cross was filled in/);
});

test("a mislabelled BOJ series is not plotted", async () => {
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes("stat-search.boj.or.jp")) {
      const payload = bojPayload([{ date: "2026-11-11", value: 158.88 }]);
      payload.RESULTSET[0].UNIT = "Index";
      return new Response(JSON.stringify(payload), { status: 200 });
    }
    if (href.includes("D.USD.EUR")) return new Response(USD_CSV, { status: 200 });
    if (href.includes("D.JPY.EUR")) return new Response(JPY_CSV, { status: 200 });
    throw new Error(`unexpected url ${href}`);
  };
  const report = await buildSourceReport({ fetchImpl, now: new Date("2026-11-14T00:00:00Z") });
  assert.equal(report.boj.status, "gap");
  assert.deepEqual(report.boj.points, []);
});
