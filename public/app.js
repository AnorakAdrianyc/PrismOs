import { paperScenario } from "./paper-scenario.js";

const scenario = paperScenario();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const chart = document.querySelector("#scenario-chart");
const live = document.querySelector("#scenario-live");
const replay = document.querySelector("#replay");

const yMin = 158.6;
const yMax = 160.4;
const plot = { left: 56, right: 16, top: 18, bottom: 36, width: 640, height: 240 };

/**
 * @param {number} value
 * @returns {number}
 */
function yOf(value) {
  const inner = plot.height - plot.top - plot.bottom;
  return plot.top + ((yMax - value) / (yMax - yMin)) * inner;
}

/**
 * @param {number} progress
 */
function drawScenario(progress) {
  const x0 = plot.left + 48;
  const x1 = plot.width - plot.right - 36;
  const y0 = yOf(scenario.thresholdYen);
  const y1 = yOf(scenario.markYen);
  const x = x0 + (x1 - x0) * progress;
  const y = y0 + (y1 - y0) * progress;
  const ns = "http://www.w3.org/2000/svg";

  chart.replaceChildren();
  const grid = (value, label) => {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(plot.left));
    line.setAttribute("x2", String(plot.width - plot.right));
    line.setAttribute("y1", String(yOf(value)));
    line.setAttribute("y2", String(yOf(value)));
    line.setAttribute("stroke", "#e0d5c3");
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", "8");
    text.setAttribute("y", String(yOf(value) + 4));
    text.setAttribute("fill", "#3a342c");
    text.setAttribute("font-size", "12");
    text.textContent = label;
    return [line, text];
  };

  for (const node of [
    ...grid(160, "160"),
    ...grid(159, "159"),
  ]) {
    chart.append(node);
  }

  const path = document.createElementNS(ns, "line");
  path.setAttribute("x1", String(x0));
  path.setAttribute("y1", String(y0));
  path.setAttribute("x2", String(x));
  path.setAttribute("y2", String(y));
  path.setAttribute("stroke", "#9a4d12");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-dasharray", "7 5");
  chart.append(path);

  const dot = document.createElementNS(ns, "circle");
  dot.setAttribute("cx", String(x));
  dot.setAttribute("cy", String(y));
  dot.setAttribute("r", "6");
  dot.setAttribute("fill", "#9a4d12");
  chart.append(dot);

  const caption = document.createElementNS(ns, "text");
  caption.setAttribute("x", String(plot.left));
  caption.setAttribute("y", String(plot.height - 10));
  caption.setAttribute("fill", "#3a342c");
  caption.setAttribute("font-size", "13");
  caption.textContent = "Classroom path · not a market print";
  chart.append(caption);
}

function announceScenario() {
  live.textContent =
    "Simulated mark 159 yen per dollar. Paper result −10,000 yen. This is the classroom path, not a market print.";
}

/**
 * @param {number} progress
 */
function setProgress(progress) {
  drawScenario(progress);
}

function play() {
  if (reduceMotion) {
    setProgress(1);
    announceScenario();
    return;
  }
  const started = performance.now();
  const duration = 1400;
  const frame = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    setProgress(progress);
    if (progress < 1) requestAnimationFrame(frame);
    else announceScenario();
  };
  requestAnimationFrame(frame);
}

replay.addEventListener("click", play);
setProgress(1);

/**
 * @param {string} label
 * @param {string} href
 */
function linkLine(label, href) {
  const p = el("p");
  p.append(`${label}: `);
  const a = document.createElement("a");
  a.href = href;
  a.textContent = href;
  p.append(a);
  return p;
}

/**
 * @param {string} tag
 * @param {string} [text]
 * @param {string} [className]
 */
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function prettyDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

/**
 * @param {number} value
 * @param {number} digits
 */
function rate(value, digits) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * @param {HTMLElement} host
 * @param {string[]} headers
 * @param {string[][]} rows
 * @param {string} caption
 */
function renderTable(host, headers, rows, caption) {
  const wrap = el("div", null, "table-wrap");
  const table = document.createElement("table");
  const cap = document.createElement("caption");
  cap.textContent = caption;
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((header, index) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    if (index > 0) cell.className = "num";
    headRow.append(cell);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    row.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      else cell.className = "num";
      cell.textContent = value;
      tr.append(cell);
    });
    tbody.append(tr);
  }
  table.append(cap, thead, tbody);
  wrap.append(table);
  host.append(wrap);
}

/**
 * @param {HTMLElement} host
 * @param {{ date: string, value: number }[]} points
 */
function renderLine(host, points) {
  if (points.length < 2) return;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = min === max ? 0.5 : (max - min) * 0.2;
  const low = min - pad;
  const high = max + pad;
  const width = 640;
  const height = 200;
  const left = 16;
  const right = 12;
  const top = 12;
  const bottom = 28;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const yFor = (value) => top + ((high - value) / (high - low)) * (height - top - bottom);
  const xFor = (index) =>
    left + (index / (points.length - 1)) * (width - left - right);

  const note = document.createElementNS(ns, "text");
  note.setAttribute("x", String(left));
  note.setAttribute("y", String(height - 8));
  note.setAttribute("fill", "#3a342c");
  note.setAttribute("font-size", "12");
  note.textContent = "Published points only. Values are in the table.";
  svg.append(note);

  const poly = document.createElementNS(ns, "polyline");
  poly.setAttribute(
    "points",
    points.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(" "),
  );
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "#1e3a5f");
  poly.setAttribute("stroke-width", "2.5");
  svg.append(poly);
  host.append(svg);
}

/**
 * @param {object} boj
 */
function renderBoj(boj) {
  const status = document.querySelector("#boj-status");
  const body = document.querySelector("#boj-body");
  body.replaceChildren();
  if (boj.status !== "ok") {
    status.textContent = "Gap.";
    body.append(el("p", boj.message ?? "No Bank of Japan figure is available.", "gap"));
    return;
  }
  status.textContent = boj.hasArticleDate
    ? `Published series loaded. It includes ${prettyDate(boj.articleDate)}.`
    : `Published series loaded. It has no observation on ${prettyDate(boj.articleDate)}. Latest point: ${prettyDate(boj.latest.date)} at ${rate(boj.latest.value, 2)}.`;
  if (!boj.hasArticleDate) {
    body.append(
      el(
        "p",
        `No Tokyo 17:00 observation dated ${prettyDate(boj.articleDate)} was in this response. That day is left blank.`,
        "gap",
      ),
    );
  }
  body.append(el("p", `${boj.seriesName}. Unit: ${boj.unit}.`));
  if (boj.requestUrl) body.append(linkLine("Request sent", boj.requestUrl));
  if (boj.lastUpdate) body.append(el("p", `Series last update stamp: ${prettyDate(boj.lastUpdate)}.`));
  renderLine(body, boj.points);
  renderTable(
    body,
    ["Date", "Yen per US dollar"],
    boj.points.map((point) => [prettyDate(point.date), rate(point.value, 2)]),
    "Bank of Japan Tokyo 17:00 observations returned for this window. Missing dates are omitted, not filled.",
  );
}

/**
 * @param {object} ecb
 */
function renderEcb(ecb) {
  const status = document.querySelector("#ecb-status");
  const body = document.querySelector("#ecb-body");
  body.replaceChildren();
  if (ecb.status !== "ok") {
    status.textContent = "Gap.";
    body.append(el("p", ecb.message ?? "No ECB cross is available.", "gap"));
    return;
  }
  const latest = ecb.latest;
  status.textContent = ecb.hasArticleDate
    ? `Euro reference rates loaded, including ${prettyDate(ecb.articleDate)}. The yen-per-dollar column is a division, not a published USD/JPY fixing.`
    : `Euro reference rates loaded. No shared observation on ${prettyDate(ecb.articleDate)}. Latest cross: ${prettyDate(latest.date)}.`;
  if (!ecb.hasArticleDate) {
    body.append(
      el(
        "p",
        `No ECB cross dated ${prettyDate(ecb.articleDate)} was in this response. That day is left blank.`,
        "gap",
      ),
    );
  }
  if (ecb.links?.usdPerEur) body.append(linkLine("Dollars per euro", ecb.links.usdPerEur));
  if (ecb.links?.jpyPerEur) body.append(linkLine("Yen per euro", ecb.links.jpyPerEur));
  renderTable(
    body,
    ["Date", "USD per 1 EUR", "JPY per 1 EUR", "Yen per dollar"],
    ecb.points.map((point) => [
      prettyDate(point.date),
      rate(point.usdPerEur, 4),
      rate(point.jpyPerEur, 2),
      rate(point.yenPerDollar, 4),
    ]),
    "Computed cross: yen per euro divided by dollars per euro. Not the paper book.",
  );
}

function mountTradingView() {
  const status = document.querySelector("#tv-status");
  const container = document.querySelector("#tv-container");
  const holder = el("div");
  holder.className = "tradingview-widget-container__widget";
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
  script.async = true;
  script.textContent = JSON.stringify({
    symbol: "FX:USDJPY",
    width: "100%",
    height: 220,
    locale: "en",
    dateRange: "1M",
    colorTheme: "light",
    isTransparent: true,
    autosize: true,
    largeChartUrl: "",
  });
  const showGap = () => {
    status.textContent =
      "Gap. The TradingView widget did not load. No TradingView price was written in. You can open their public symbol page from the link above.";
  };
  script.addEventListener("error", showGap);
  const timer = window.setTimeout(() => {
    if (!container.querySelector("iframe")) showGap();
    else status.textContent = "TradingView widget loaded. Its price is not copied into the paper book.";
  }, 8000);
  script.addEventListener("load", () => {
    window.setTimeout(() => {
      window.clearTimeout(timer);
      if (!container.querySelector("iframe")) showGap();
      else status.textContent = "TradingView widget loaded. Its price is not copied into the paper book.";
    }, 1500);
  });
  container.append(holder, script);
}

async function loadFeeds() {
  try {
    const response = await fetch("/api/sources", { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const report = await response.json();
    renderBoj(report.boj ?? { status: "gap", message: "The report had no Bank of Japan section." });
    renderEcb(report.ecb ?? { status: "gap", message: "The report had no ECB section." });
  } catch {
    const message = "The local reference report did not complete. No official rate was filled in.";
    renderBoj({ status: "gap", message });
    renderEcb({ status: "gap", message });
  }
}

loadFeeds();
mountTradingView();
