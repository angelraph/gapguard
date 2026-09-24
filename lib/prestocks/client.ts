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

export async function fetchPreStocks(): Promise<PreStock[]> {
  const res = await fetch(PRESTOCKS_API_URL, {
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`PreStocks API failed (${res.status})`);
  }
  const raw: RawPreStock[] = await res.json();

  return raw
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
}
