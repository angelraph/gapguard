/**
 * Jupiter's free token search API, used here to get the live USD price of
 * an xStock token by its exact mint address. Free, no signup, no key.
 *
 * Checked live on 2026-09-17:
 *   GET https://lite-api.jup.ag/tokens/v2/search?query=<mint>
 * returns that exact token's record including `usdPrice` and
 * `updatedAt` — a real, aggregated, on-chain-derived market price, not a
 * single-oracle number.
 *
 * IMPORTANT: always query by the verified mint address (see
 * lib/stocks/curatedList.ts), never by symbol. Searching by symbol alone
 * returns many unrelated and sometimes fake tokens sharing the same name.
 */

const JUPITER_SEARCH_URL = "https://lite-api.jup.ag/tokens/v2/search";

type JupiterTokenRecord = {
  id: string;
  symbol: string;
  usdPrice?: number;
  updatedAt: string;
  isVerified?: boolean;
};

export type JupiterPrice = {
  mint: string;
  usdPrice: number;
  /** Unix seconds, converted from Jupiter's ISO `updatedAt`. */
  updatedAtSec: number;
};

export async function fetchJupiterPrice(mint: string): Promise<JupiterPrice> {
  const res = await fetch(
    `${JUPITER_SEARCH_URL}?query=${encodeURIComponent(mint)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Jupiter token search failed (${res.status}) for ${mint}`);
  }

  const results: JupiterTokenRecord[] = await res.json();
  const match = results.find((r) => r.id === mint);
  if (!match || match.usdPrice === undefined) {
    throw new Error(`No live price returned by Jupiter for mint ${mint}`);
  }

  return {
    mint,
    usdPrice: match.usdPrice,
    updatedAtSec: Math.floor(new Date(match.updatedAt).getTime() / 1000),
  };
}

export async function fetchJupiterPrices(
  mints: string[]
): Promise<Map<string, JupiterPrice>> {
  const results = await Promise.allSettled(mints.map(fetchJupiterPrice));
  const byMint = new Map<string, JupiterPrice>();

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      byMint.set(mints[i], result.value);
    } else {
      console.error(`Jupiter price fetch failed for ${mints[i]}:`, result.reason);
    }
  });

  return byMint;
}
