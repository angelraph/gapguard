/**
 * The shape every price data source (Pyth, or the free Jupiter+Yahoo
 * fallback) must produce. Keeping this one shared shape is what lets
 * GapGuard swap data sources without touching the API route or any page.
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
  /** Seconds since the real-world stock price last updated. */
  equityStalenessSec: number;
  /** True once staleness implies the real stock market is closed. */
  marketLikelyClosed: boolean;
};

/**
 * Which provider actually produced this data, so the UI can label it
 * honestly instead of implying it's always Pyth.
 */
export type MarketDataSource = "pyth" | "free";

export type MarketDataResult = {
  source: MarketDataSource;
  stocks: StockBasis[];
};
