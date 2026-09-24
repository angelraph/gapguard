import { HermesParsedPrice, toDecimal } from "./client";
import { CURATED_STOCKS } from "../stocks/curatedList";
import { PYTH_FEED_IDS } from "./feedIds";
import { isRegularSessionOpen } from "../marketData/session";

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
  /** True outside the regular US session (9:30am to 4pm ET, weekdays). */
  marketLikelyClosed: boolean;
};


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
      // Regular session hours, not feed freshness: Pyth keeps publishing
      // thinner after-hours prices, so a fresh feed does not mean "open".
      marketLikelyClosed: !isRegularSessionOpen(),
    });
  }

  return results;
}
