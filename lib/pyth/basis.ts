import { HermesParsedPrice, toDecimal } from "./client";
import { CURATED_STOCKS } from "../stocks/curatedList";
import { PYTH_FEED_IDS } from "./feedIds";

/**
 * The core GapGuard computation: how far has a tokenized stock's on-chain
 * price drifted from its last known traditional-market price, and how
 * stale is that traditional-market anchor right now?
 *
 * When NYSE is open, `equity` updates continuously and this is a live
 * basis. When NYSE is closed, `equity` freezes at its last print while
 * `xstock` keeps moving 24/7 — the growing basis *and* growing staleness
 * together are the whole thesis of the product, so both are surfaced,
 * never just one.
 */
export type StockBasis = {
  ticker: string;
  name: string;
  equityPrice: number;
  equityPublishTime: number;
  xstockPrice: number;
  xstockPublishTime: number;
  /** (xstockPrice - equityPrice) / equityPrice, as a fraction (0.03 = 3%) */
  basis: number;
  /** Seconds since the equity feed last published. */
  equityStalenessSec: number;
  /** True once staleness implies the traditional market is closed. */
  marketLikelyClosed: boolean;
};

/** Equity feeds publish continuously while NYSE is open; beyond this gap
 * (2x their fastest normal cadence, given generous margin for a slow tick)
 * we treat it as "market closed", independent of Hermes's own market_hours
 * metadata (which is fetched separately and can corroborate this). */
const STALENESS_THRESHOLD_SEC = 60 * 5;

export function computeBasis(prices: HermesParsedPrice[]): StockBasis[] {
  const byId = new Map(prices.map((p) => [p.id, p]));
  const nowSec = Date.now() / 1000;
  const results: StockBasis[] = [];

  for (const stock of CURATED_STOCKS) {
    const feeds = PYTH_FEED_IDS[stock.ticker];
    const equity = byId.get(feeds.equity);
    const xstock = byId.get(feeds.xstock);
    if (!equity || !xstock) continue;

    const equityPrice = toDecimal(equity.price.price, equity.price.expo);
    const xstockPrice = toDecimal(xstock.price.price, xstock.price.expo);
    const equityStalenessSec = nowSec - equity.price.publish_time;

    results.push({
      ticker: stock.ticker,
      name: stock.name,
      equityPrice,
      equityPublishTime: equity.price.publish_time,
      xstockPrice,
      xstockPublishTime: xstock.price.publish_time,
      basis: (xstockPrice - equityPrice) / equityPrice,
      equityStalenessSec,
      marketLikelyClosed: equityStalenessSec > STALENESS_THRESHOLD_SEC,
    });
  }

  return results;
}
