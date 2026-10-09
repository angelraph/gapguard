/**
 * PreStocks (tokenized pre-IPO stock) data, from PreStocks' own free public
 * API: https://prestocks.com/api/prestocks
 *
 * Each token comes with two prices, which is exactly what GapGuard needs:
 *  - markPrice: the issuer's own mark for the private company. It only
 *    changes when the issuer updates it (funding rounds, secondary sales),
 *    so it behaves like the "last real price" of a stock whose market is
 *    closed, except for pre-IPO companies the market is always closed.
 *  - tokenPrice: what the token actually trades at on Solana right now.
 *
 * The gap between them is the same risk GapGuard tracks for public stocks:
 * a price on-chain that the real world has not confirmed. When the mark is
 * next updated, holders on the wrong side of a big gap take the hit at once.
 */

import { getCached, setCached } from "../alerts/store";

const PRESTOCKS_API_URL = "https://prestocks.com/api/prestocks";

type RawPreStock = {
  name: string;
  symbol: string;
  image: string;
  external_url: string;
  contract_address: string;
  markPrice: number;
  markValuation: number;
  tokenPrice: number;
  impliedValuation: number;
  supply: number;
};

export type PreStock = {
  symbol: string;
  company: string;
  mint: string;
  image: string;
  url: string;
  markPrice: number;
  tokenPrice: number;
  /** (tokenPrice - markPrice) / markPrice, as a fraction (0.31 = +31%) */
  gap: number;
  markValuationUsd: number;
  impliedValuationUsd: number;
  supply: number;
};

/**
 * PreStocks' API sometimes answers with an empty or price-less list for a
 * minute or two. So: retry once, never cache a bad answer, and fall back to
 * the last good list (kept in memory and in the shared store, so a freshly
 * started server has it too) for up to 6 hours.
 */
const FRESH_MS = 30_000;
const STALE_LIMIT_MS = 6 * 60 * 60 * 1000;
const CACHE_NAME = "prestocks";

let lastGood: { at: number; value: PreStock[] } | null = null;

/** How old the prices fetchPreStocks last returned are, in ms (0 if none yet). */
export function preStocksAgeMs(): number {
  return lastGood ? Date.now() - lastGood.at : 0;
}

export async function fetchPreStocks(): Promise<PreStock[]> {
  if (lastGood && Date.now() - lastGood.at < FRESH_MS) return lastGood.value;

  let failure: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const list = await fetchOnce();
      lastGood = { at: Date.now(), value: list };
      setCached(CACHE_NAME, list).catch(() => {});
      return list;
    } catch (err) {
      failure = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }

  if (!lastGood) {
    lastGood = await getCached<PreStock[]>(CACHE_NAME).catch(() => null);
  }
  if (lastGood && Date.now() - lastGood.at < STALE_LIMIT_MS) {
    console.warn("PreStocks unavailable, using the last good prices:", failure);
    return lastGood.value;
  }
  throw failure;
}

async function fetchOnce(): Promise<PreStock[]> {
  const res = await fetch(PRESTOCKS_API_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) {
    throw new Error(`PreStocks API failed (${res.status})`);
  }
  const raw = (await res.json()) as RawPreStock[];
  if (!Array.isArray(raw)) throw new Error("PreStocks API returned an unexpected answer");

  const list = raw
    .filter((p) => p.markPrice > 0 && p.tokenPrice > 0)
    .map((p) => ({
      symbol: p.symbol,
      company: p.name.replace(/\s*PreStocks$/i, ""),
      mint: p.contract_address,
      image: p.image,
      url: p.external_url,
      markPrice: p.markPrice,
      tokenPrice: p.tokenPrice,
      gap: (p.tokenPrice - p.markPrice) / p.markPrice,
      markValuationUsd: p.markValuation,
      impliedValuationUsd: p.impliedValuation,
      supply: p.supply,
    }));
  if (list.length === 0) throw new Error(`PreStocks API returned no priced tokens (${raw.length} rows)`);
  return list;
}
