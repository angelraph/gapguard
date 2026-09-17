import { CURATED_STOCKS } from "../stocks/curatedList";
import { fetchJupiterPrices } from "./jupiter";
import { fetchYahooQuotes } from "./yahoo";
import type { StockBasis } from "./types";

/** Same threshold used in lib/pyth/basis.ts, for the same reason: equity
 * prices update continuously while the real market is open, so a long gap
 * since the last update means the market is closed. */
const STALENESS_THRESHOLD_SEC = 60 * 5;

/**
 * Builds the same `StockBasis[]` shape the Pyth-based source produces, but
 * from two free, no-key sources: Jupiter (the xStock token's real trading
 * price) and Yahoo Finance (the real stock's price). See lib/marketData/jupiter.ts
 * and lib/marketData/yahoo.ts for details and caveats on each.
 */
export async function fetchFreeStockBasis(): Promise<StockBasis[]> {
  const mints = CURATED_STOCKS.map((s) => s.mint);
  const tickers = CURATED_STOCKS.map((s) => s.ticker);

  const [jupiterPrices, yahooQuotes] = await Promise.all([
    fetchJupiterPrices(mints),
    fetchYahooQuotes(tickers),
  ]);

  const nowSec = Date.now() / 1000;
  const results: StockBasis[] = [];

  for (const stock of CURATED_STOCKS) {
    const xstock = jupiterPrices.get(stock.mint);
    const equity = yahooQuotes.get(stock.ticker);
    if (!xstock || !equity) continue;

    const equityStalenessSec = nowSec - equity.publishTimeSec;

    results.push({
      ticker: stock.ticker,
      name: stock.name,
      equityPrice: equity.price,
      equityPublishTime: equity.publishTimeSec,
      xstockPrice: xstock.usdPrice,
      xstockPublishTime: xstock.updatedAtSec,
      basis: (xstock.usdPrice - equity.price) / equity.price,
      equityStalenessSec,
      marketLikelyClosed: equityStalenessSec > STALENESS_THRESHOLD_SEC,
    });
  }

  return results;
}
