# PrismOS

PrismOS is a one-page educational sandbox for **BUHack 2.0 (FinTech)**. It walks a single path you can audit:

1. One public news report, with the publisher and the date on screen.
2. A simulated USD/JPY move in a paper book, produced by a labelled classroom rule.
3. A plain-language tutor that explains why the lesson connected those two, and how to check the source.

The product idea is a risk-free way to practice reading how public information and currency moves get linked, including a short pause for pattern recognition and scam-shaped headlines. This repository is the lightweight hackathon demo, not the full capstone and not a trading system.

## Guardrails

This is **paper trading only**.

- Not real money. There is no deposit, no wallet, and no customer account.
- Not financial advice. The tutor explains a link. It does not tell you to buy or sell, and it does not name a level to aim at.
- No live trading. There is no “go live” control, no broker session, and no code path that can submit an order.
- The paper numbers are a classroom rule (`short-cover-reading`). They are not a forecast and not a claim that the demo can beat a market.
- If an official feed fails, the page shows a gap and leaves it empty. It does not invent a quote.

## Run the demo

Requires Node.js 20 or newer. There are no dependencies and no API keys.

```bash
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

That one command serves the page and a same-origin report of official reference rates. Optional checks:

```bash
npm test
PORT=4180 npm start
```

`npm test` does not use the network. The Bank of Japan and ECB figures appear only when the server can reach those sites. The news card, the paper book, and the tutor still work if the feeds do not.

## Deploy on Vercel

`npm start` stays the local command. Vercel does not run `server.mjs`. The deployment is the static lesson plus one function, still with no API keys and no install dependencies.

- `public/` is the site. `vercel.json` sets `outputDirectory` to `public`, so `/` is `public/index.html`. `/styles.css`, `/app.js`, and `/paper-scenario.js` stay at those paths.
- `api/sources.mjs` is the serverless function for `GET /api/sources`. It calls `buildSourceReport()` in `lib/sources.mjs`. That is the same Bank of Japan and ECB lookup the local server uses. The paper book does not use those feeds. Interactive Brokers is not called, and there is no order route.

No environment variables. In the Vercel project, leave the framework as Other and leave the build command empty. The repo’s `engines.node` is `>=20`. Vercel’s available majors are 22, 24, and 26 (Node.js 20 is no longer offered there); a range of `>=20` selects a current runtime. The function only uses `fetch` and ESM, which those versions provide.

After the project exists, deploy this branch. The lesson page and `/api/sources` should both answer.

## What you should see

**Signal.** Headline: “Japan to take appropriate action to stem yen slide if required: Katayama.” Source: The Mainichi (Kyodo), November 13, 2026. The card quotes the page and links to it. The excerpt was checked on 14 November 2026 and is not re-downloaded on each run. If the live page disagrees with the card, trust the page.

**Simulated move.** Pair: USD/JPY. The lesson anchor is the whole number in the article’s phrase “above 160”. The article does not say the rate was exactly 160.00. A classroom constant of −1.00 yen (rule `short-cover-reading`) marks the paper book at 159. That downward step is a typical reading of an intervention warning — people who had sold yen sometimes repurchase yen, which would print as a lower USD/JPY. It is a picture of that habit, not a statement that it happened, and not a trade to copy.

Paper result on a book of 10,000 US dollars:

- Yen: `10,000 × (159 − 160) = −10,000 yen`
- Dollars, converted at the scenario mark: `−10,000 / 159`, which is −62.89 USD to the cent

Replay redraws that classroom line only.

**Tutor.** Why the demo drew the line that way, how to verify the Mainichi page, and a short anti-scam pause: a named official, a round number, and urgent wording is the shape of both real wire copy and posts that want you to act too fast.

Official rates, when they load, sit under the paper book and are **not inputs to it**.

## External sources

| Source | What this demo does | What it does not do |
| --- | --- | --- |
| [The Mainichi / Kyodo, 13 Nov 2026](https://mainichi.jp/english/articles/20261113/p2g/00m/0bu/048000c) | Shows the checked headline, date, link, and the sentences used in the lesson | Does not scrape the article at runtime |
| [Bank of Japan Time-Series Data Search](https://www.stat-search.boj.or.jp/info/api_manual_en.pdf) | `GET /api/v1/getDataCode` for database `FM08`, series `FXERD04` (US dollar / yen spot at 17:00 JST, Tokyo). No key. [Series table](https://www.stat-search.boj.or.jp/ssi/mtshtml/fm08_d_1_en.html) | Does not fill a missing day. The article’s New York “above 160” is a different clock from Tokyo 17:00 |
| [ECB Data Portal](https://data.ecb.europa.eu/help/api/data) | Daily euro reference rates `D.USD.EUR.SP00.A` and `D.JPY.EUR.SP00.A` from `data-api.ecb.europa.eu`. Yen per dollar is `(yen per euro) / (dollars per euro)` | Does not pretend the ECB publishes that USD/JPY key. `D.JPY.USD.SP00.A` returns no series, and the page says so |
| [TradingView widgets](https://www.tradingview.com/widget/) | May embed the free `FX:USDJPY` mini chart in your browser. [Symbol page](https://www.tradingview.com/symbols/USDJPY/) | No public quote API, so the server never requests a TradingView price and never copies one into the paper book. If the widget does not load, the panel stays a gap |
| [Interactive Brokers API FAQ](https://www.interactivebrokers.com/support/faq/articles/614720743) | Names IB as skipped | Client Portal, TWS, and FIX need an authenticated IBKR Pro login, including for a paper account. No request is sent. No order route exists |

The local report is `GET /api/sources`. Its `paperBookUsesFeeds` field is `false`.

## Out of scope

Multi-source fusion, live execution, position sizing, backtests offered as proof, and any “beat the market” claim. The demo shows traceability (signal → simulated book → explanation), not predictive skill.

## Layout

- `public/` — the page, the classroom rule, and the browser code. This is also the Vercel static output.
- `lib/sources.mjs` — Bank of Japan and ECB fetchers, plus the explicit skip for TradingView quotes and Interactive Brokers
- `server.mjs` — local static files and `/api/sources` only. Fixed hosts. Redirects are rejected.
- `api/sources.mjs` — the Vercel function for `GET /api/sources`. It reuses `lib/sources.mjs`.
- `vercel.json` — serves `public/` at `/` and keeps the function config next to it
- `test/` — paper arithmetic, parsers, “a failed feed stays empty”, and a copy check against trade instructions
