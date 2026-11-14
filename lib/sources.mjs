/**
 * Official reference rates for the PrismOS lesson.
 *
 * Bank of Japan: direct yen-per-dollar Tokyo print, no API key.
 * ECB: two euro reference rates, divided on this server. The direct USD/JPY
 * key on the ECB API returns no series, so a missing ECB leg stays a gap.
 *
 * Interactive Brokers is not requested. TradingView is not requested.
 * Nothing here submits an order.
 */

export const ARTICLE_DATE = "2026-11-13";

export const LINKS = {
  bojManual: "https://www.stat-search.boj.or.jp/info/api_manual_en.pdf",
  bojSeriesPage: "https://www.stat-search.boj.or.jp/ssi/mtshtml/fm08_d_1_en.html",
  ecbHelp: "https://data.ecb.europa.eu/help/api/data",
  tradingviewWidgets: "https://www.tradingview.com/widget/",
  tradingviewSymbol: "https://www.tradingview.com/symbols/USDJPY/",
  ibFaq: "https://www.interactivebrokers.com/support/faq/articles/614720743",
};

const BOJ_ENDPOINT = "https://www.stat-search.boj.or.jp/api/v1/getDataCode";
const ECB_USD_URL =
  "https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=10&format=csvdata";
const ECB_JPY_URL =
  "https://data-api.ecb.europa.eu/service/data/EXR/D.JPY.EUR.SP00.A?lastNObservations=10&format=csvdata";

const USER_AGENT = "PrismOS-BUHack-demo/0.1 (educational paper sandbox; no orders)";

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function formatYmd(value) {
  const raw = String(value ?? "");
  if (!/^\d{8}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/**
 * @param {Date} now
 * @returns {{ startDate: string, endDate: string }}
 */
export function bojMonthWindow(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, 1));
  const fmt = (date) =>
    `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

/**
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.length > 0));
}

/**
 * @param {string[][]} rows
 * @returns {Record<string, string>[]}
 */
export function rowsToRecords(rows) {
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    /** @type {Record<string, string>} */
    const record = {};
    header.forEach((name, index) => {
      record[name] = cells[index] ?? "";
    });
    return record;
  });
}

/**
 * @param {object} series
 * @returns {{ date: string, value: number }[]}
 */
export function bojObservations(series) {
  const dates = series?.VALUES?.SURVEY_DATES;
  const values = series?.VALUES?.VALUES;
  if (!Array.isArray(dates) || !Array.isArray(values)) return [];
  /** @type {{ date: string, value: number }[]} */
  const points = [];
  const count = Math.min(dates.length, values.length);
  for (let i = 0; i < count; i += 1) {
    const date = formatYmd(dates[i]);
    const value = asNumber(values[i]);
    if (!date || value === null) continue;
    points.push({ date, value });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * @param {Record<string, string>[]} records
 * @param {string} currency
 * @returns {{ date: string, value: number }[]}
 */
export function ecbLeg(records, currency) {
  /** @type {{ date: string, value: number }[]} */
  const points = [];
  for (const record of records) {
    if (record.CURRENCY !== currency || record.CURRENCY_DENOM !== "EUR") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.TIME_PERIOD ?? "")) continue;
    const value = asNumber(record.OBS_VALUE);
    if (value === null) continue;
    points.push({ date: record.TIME_PERIOD, value });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/**
 * Yen per dollar = (yen per euro) / (dollars per euro), matched on date.
 * @param {{ date: string, value: number }[]} usdPerEur
 * @param {{ date: string, value: number }[]} jpyPerEur
 * @returns {{ date: string, usdPerEur: number, jpyPerEur: number, yenPerDollar: number }[]}
 */
export function crossUsdJpy(usdPerEur, jpyPerEur) {
  const dollars = new Map(usdPerEur.map((point) => [point.date, point.value]));
  /** @type {{ date: string, usdPerEur: number, jpyPerEur: number, yenPerDollar: number }[]} */
  const crossed = [];
  for (const yen of jpyPerEur) {
    const dollarsPerEuro = dollars.get(yen.date);
    if (dollarsPerEuro == null || dollarsPerEuro === 0) continue;
    crossed.push({
      date: yen.date,
      usdPerEur: dollarsPerEuro,
      jpyPerEur: yen.value,
      yenPerDollar: yen.value / dollarsPerEuro,
    });
  }
  crossed.sort((a, b) => a.date.localeCompare(b.date));
  return crossed;
}

/**
 * @param {string} message
 * @param {string} [requestUrl]
 * @returns {{ status: "gap", message: string, requestUrl: string | null, points: [] }}
 */
function gap(message, requestUrl = null) {
  return { status: "gap", message, requestUrl, points: [] };
}

/**
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 * @param {number} timeoutMs
 * @param {string} accept
 */
async function requestText(url, fetchImpl, timeoutMs, accept) {
  const response = await fetchImpl(url, {
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      accept,
      "user-agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return response.text();
}

/**
 * @param {{ fetchImpl?: typeof fetch, now?: Date, timeoutMs?: number }} [options]
 */
export async function loadBankOfJapan(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const { startDate, endDate } = bojMonthWindow(options.now ?? new Date());
  const url = new URL(BOJ_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "en");
  url.searchParams.set("db", "FM08");
  url.searchParams.set("code", "FXERD04");
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  const requestUrl = url.toString();

  let payload;
  try {
    const body = await requestText(requestUrl, fetchImpl, timeoutMs, "application/json");
    payload = JSON.parse(body);
  } catch (error) {
    const statusCode = /** @type {{ statusCode?: number }} */ (error).statusCode;
    const message = statusCode
      ? `Bank of Japan responded with HTTP ${statusCode}. No rate was filled in.`
      : "The Bank of Japan request did not complete. No rate was filled in.";
    return gap(message, requestUrl);
  }

  if (!payload || payload.STATUS !== 200 || !Array.isArray(payload.RESULTSET)) {
    return gap("Bank of Japan did not return a usable series. No rate was filled in.", requestUrl);
  }

  const series = payload.RESULTSET.find((item) => item?.SERIES_CODE === "FXERD04");
  if (!series) {
    return gap("Bank of Japan did not return series FXERD04. No rate was filled in.", requestUrl);
  }

  const name = String(series.NAME_OF_TIME_SERIES ?? "");
  const unit = String(series.UNIT ?? "");
  if (!/yen/i.test(name) || !/yen per u\.s\. dollar/i.test(unit)) {
    return gap(
      "The Bank of Japan series name or unit was not yen per US dollar. Nothing was plotted.",
      requestUrl,
    );
  }

  const points = bojObservations(series).slice(-12);
  if (points.length === 0) {
    return gap(
      "Bank of Japan answered, but this window had no numeric Tokyo observations. Nothing was plotted.",
      requestUrl,
    );
  }

  const latest = points[points.length - 1];
  return {
    status: "ok",
    message: null,
    requestUrl,
    seriesCode: "FXERD04",
    seriesName: name,
    unit,
    lastUpdate: formatYmd(series.LAST_UPDATE),
    articleDate: ARTICLE_DATE,
    hasArticleDate: points.some((point) => point.date === ARTICLE_DATE),
    latest,
    points,
    links: {
      manual: LINKS.bojManual,
      seriesPage: LINKS.bojSeriesPage,
    },
  };
}

/**
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 */
export async function loadEcbCross(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;

  /** @type {string[]} */
  const failures = [];
  const loadLeg = async (url, currency) => {
    try {
      const body = await requestText(url, fetchImpl, timeoutMs, "text/csv");
      const points = ecbLeg(rowsToRecords(parseCsv(body)), currency);
      if (points.length === 0) {
        failures.push(`${currency} per euro had no usable observations.`);
      }
      return points;
    } catch (error) {
      const statusCode = /** @type {{ statusCode?: number }} */ (error).statusCode;
      failures.push(
        statusCode
          ? `${currency} per euro responded with HTTP ${statusCode}.`
          : `${currency} per euro did not complete.`,
      );
      return [];
    }
  };

  const [usdPerEur, jpyPerEur] = await Promise.all([
    loadLeg(ECB_USD_URL, "USD"),
    loadLeg(ECB_JPY_URL, "JPY"),
  ]);

  if (failures.length > 0) {
    return gap(
      `ECB reference rates are incomplete. ${failures.join(" ")} No cross was filled in.`,
      ECB_USD_URL,
    );
  }

  const points = crossUsdJpy(usdPerEur, jpyPerEur).slice(-10);
  if (points.length === 0) {
    return gap("ECB euro rates did not share a date, so no yen-per-dollar cross was filled in.", ECB_USD_URL);
  }

  const latest = points[points.length - 1];
  return {
    status: "ok",
    message: null,
    requestUrl: ECB_USD_URL,
    articleDate: ARTICLE_DATE,
    hasArticleDate: points.some((point) => point.date === ARTICLE_DATE),
    latest,
    points,
    links: {
      help: LINKS.ecbHelp,
      usdPerEur: ECB_USD_URL,
      jpyPerEur: ECB_JPY_URL,
    },
  };
}

/**
 * Static policy records. These hosts are intentionally not fetched.
 * @returns {{ tradingview: object, interactiveBrokers: object }}
 */
export function skippedVendors() {
  return {
    tradingview: {
      status: "widget-only",
      calledForQuote: false,
      symbol: "FX:USDJPY",
      message:
        "TradingView does not offer a public quote API. This server does not ask TradingView for a price. The page may embed their free chart widget in the browser. A number inside that frame is not copied into the paper book.",
      links: {
        widgets: LINKS.tradingviewWidgets,
        symbol: LINKS.tradingviewSymbol,
      },
    },
    interactiveBrokers: {
      status: "skipped",
      called: false,
      message:
        "Interactive Brokers market data and paper accounts require an authenticated IBKR Pro login (Client Portal, TWS, or FIX). This demo has no login, sends no request to Interactive Brokers, and has no order route.",
      links: {
        faq: LINKS.ibFaq,
      },
    },
  };
}

/**
 * @param {{ fetchImpl?: typeof fetch, now?: Date, timeoutMs?: number }} [options]
 */
export async function buildSourceReport(options = {}) {
  const [boj, ecb] = await Promise.all([
    loadBankOfJapan(options),
    loadEcbCross(options),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    paperBookUsesFeeds: false,
    boj,
    ecb,
    ...skippedVendors(),
  };
}

/**
 * Used when the report itself throws. Same policy fields as a normal report:
 * no invented rates, and no broker call.
 * @returns {object}
 */
export function failedSourceReport() {
  return {
    fetchedAt: new Date().toISOString(),
    paperBookUsesFeeds: false,
    boj: {
      status: "gap",
      message: "The reference report failed before a Bank of Japan figure was read. No rate was filled in.",
      requestUrl: null,
      points: [],
    },
    ecb: {
      status: "gap",
      message: "The reference report failed before an ECB figure was read. No cross was filled in.",
      requestUrl: null,
      points: [],
    },
    ...skippedVendors(),
  };
}
