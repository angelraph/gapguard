import { fetchLatestPrices } from "../pyth/client";
import { computeBasis } from "../pyth/basis";
import { allFeedIds } from "../pyth/feedIds";
import { fetchFreeStockBasis } from "./freeSource";
import type { MarketDataResult } from "./types";

/**
 * The single place that decides where GapGuard's live price data comes
 * from. Everything else (API routes, pages) should import from here.
 *
 * Pyth is the primary source whenever a key is configured: its
 * Equity.US.<TICKER>/USD feed is the real stock, and Crypto.<TICKER>X/USD
 * is the on-chain xStock. If Pyth errors or comes back incomplete, this
 * falls back to Jupiter (on-chain price) plus Yahoo Finance (real price),
 * both free with no signup, so the site keeps working. The source that
 * actually answered is always reported back and shown on the page.
 *
 * Set MARKET_DATA_SOURCE=free to force the free source.
 */
export async function getMarketData(): Promise<MarketDataResult> {
  const wantsPyth =
    process.env.MARKET_DATA_SOURCE !== "free" && !!process.env.PYTH_API_KEY;

  if (wantsPyth) {
    try {
      const prices = await fetchLatestPrices(allFeedIds());
      const stocks = computeBasis(prices);
      if (stocks.length > 0) return { source: "pyth", stocks };
    } catch (err) {
      console.error(
        "Pyth failed, using the free source instead:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return { source: "free", stocks: await fetchFreeStockBasis() };
}
