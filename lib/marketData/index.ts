import { fetchLatestPrices } from "../pyth/client";
import { computeBasis } from "../pyth/basis";
import { allFeedIds } from "../pyth/feedIds";
import { fetchFreeStockBasis } from "./freeSource";
import type { MarketDataResult } from "./types";

/**
 * The single place that decides where GapGuard's live price data comes
 * from. Everything else (API routes, pages) should import from here, not
 * from lib/pyth or lib/marketData/freeSource directly — that's what makes
 * swapping providers a one-line change.
 *
 * Set MARKET_DATA_SOURCE=pyth in .env.local once Pyth grants access to the
 * Equity.US.* and Crypto.*X feeds this project needs (see
 * docs/submission.md). Until then, this defaults to "free": Jupiter (for
 * the on-chain xStock price) plus Yahoo Finance (for the real stock
 * price), both free and requiring no signup.
 */
export async function getMarketData(): Promise<MarketDataResult> {
  const source = process.env.MARKET_DATA_SOURCE === "pyth" ? "pyth" : "free";

  if (source === "pyth") {
    const prices = await fetchLatestPrices(allFeedIds());
    return { source: "pyth", stocks: computeBasis(prices) };
  }

  return { source: "free", stocks: await fetchFreeStockBasis() };
}
