/**
 * Yahoo Finance's public chart endpoint, used here to get the real-world
 * stock price. Free, no signup, no key — but it's an unofficial, undocumented
 * endpoint (the same one the popular `yfinance` library uses), so it can
 * change or rate-limit without notice. That's the honest tradeoff for
 * "free forever" today; see docs/submission.md.
 *
 * Checked live on 2026-09-17:
 *   GET https://query1.finance.yahoo.com/v8/finance/chart/<TICKER>?interval=1m&range=1d
 * returns `meta.regularMarketPrice` and `meta.regularMarketTime` (Unix
 * seconds of the last trade), which behaves the same way Pyth's
 * `publish_time` did: it stops advancing while the market is closed. That
 * is exactly the signal GapGuard's whole "how stale is the real-world
 * anchor" idea needs.
 */

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

type YahooChartResponse = {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        regularMarketTime: number;
      };
    }> | null;
    error: unknown;
  };
};

export type YahooQuote = {
  ticker: string;
  price: number;
  /** Unix seconds. */
  publishTimeSec: number;
};

export async function fetchYahooQuote(ticker: string): Promise<YahooQuote> {
  const res = await fetch(
    `${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}?interval=1m&range=1d`,
    {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Yahoo quote fetch failed (${res.status}) for ${ticker}`);
  }

  const data: YahooChartResponse = await res.json();
  const meta = data.chart.result?.[0]?.meta;
  if (!meta) {
    throw new Error(`No quote data returned by Yahoo for ${ticker}`);
  }

  return {
    ticker,
    price: meta.regularMarketPrice,
    publishTimeSec: meta.regularMarketTime,
  };
}

export async function fetchYahooQuotes(
  tickers: string[]
): Promise<Map<string, YahooQuote>> {
  const results = await Promise.allSettled(tickers.map(fetchYahooQuote));
  const byTicker = new Map<string, YahooQuote>();

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      byTicker.set(tickers[i], result.value);
    } else {
      console.error(`Yahoo quote fetch failed for ${tickers[i]}:`, result.reason);
    }
  });

  return byTicker;
}
