/**
 * Curated set of tokenized stocks for GapGuard.
 *
 * This is exactly the 8-symbol set Kamino's xStocks lending market launched
 * with (confirmed via Kamino's markets API / press coverage, Sep 2026):
 * AAPLx, GOOGLx, HOODx, MSTRx, NVDAx, QQQx, SPYx, TSLAx.
 *
 * Using Kamino's own list (rather than inventing our own) means the Radar's
 * aggregate "$ at risk" number lines up 1:1 with a real, named lending
 * market, which is what makes the headline number defensible instead of
 * a made-up estimate.
 *
 * Every `mint` below was checked directly against Jupiter's token search
 * on 2026-09-17 (`https://lite-api.jup.ag/tokens/v2/search?query=<mint>`)
 * and confirmed to carry `isVerified: true` and the `xstocks` tag, with
 * metadata served from Backed Finance's own domain
 * (xstocks-metadata.backed.fi). There are many fake/scam tokens using the
 * same symbol (e.g. copycat "AAPLx" tokens from pump.fun launches) — always
 * look up by mint address, never trust a symbol match alone.
 */

export type CuratedStock = {
  /** Traditional ticker, e.g. "AAPL" */
  ticker: string;
  /** Human name for display */
  name: string;
  /** xStocks (Backed/Kraken) on-chain token symbol, e.g. "AAPLx" */
  xstockSymbol: string;
  /** The real xStock's verified Solana mint address (Token-2022). */
  mint: string;
};

export const CURATED_STOCKS: CuratedStock[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    xstockSymbol: "AAPLx",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  },
  {
    ticker: "GOOGL",
    name: "Alphabet Inc. (Class A)",
    xstockSymbol: "GOOGLx",
    mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
  },
  {
    ticker: "HOOD",
    name: "Robinhood Markets Inc.",
    xstockSymbol: "HOODx",
    mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg",
  },
  {
    ticker: "MSTR",
    name: "MicroStrategy Inc.",
    xstockSymbol: "MSTRx",
    mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corp.",
    xstockSymbol: "NVDAx",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    xstockSymbol: "QQQx",
    mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    xstockSymbol: "SPYx",
    mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc.",
    xstockSymbol: "TSLAx",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
  },
];

export const CURATED_TICKERS = CURATED_STOCKS.map((s) => s.ticker);
