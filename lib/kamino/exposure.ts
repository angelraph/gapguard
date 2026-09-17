import type { KaminoMarket } from "@kamino-finance/klend-sdk";
import { CURATED_STOCKS } from "../stocks/curatedList";

/**
 * Radar's headline number: total USD value currently deposited as
 * tokenized-stock collateral on Kamino's xStocks market. This is
 * deliberately the *aggregate reserve total*, not a sum over individual
 * obligations — one read per reserve instead of enumerating every
 * position, and an honest, defensible "how much is sitting exposed" figure
 * tied to a named, real lending market.
 *
 * Uses `reserve.getDepositTvl()` — the SDK's own built-in TVL method
 * (dist/classes/reserve.js) — rather than multiplying `getTotalSupply()`
 * by `getOracleMarketPrice()` directly. An earlier version of this file
 * did exactly that and produced a wildly wrong number (~$2 quadrillion):
 * `getTotalSupply()` returns a raw, undecimalized token amount, and the
 * SDK's own `getDepositTvl()` divides by `getMintFactor()` (10^decimals)
 * to correct for that. Always prefer a library's own computed value over
 * recombining its lower-level pieces by hand.
 *
 * Matches reserves by mint address, not by symbol string. Kamino's own
 * press coverage referred to this token as "APPLx" while the actual
 * verified on-chain token (confirmed via Jupiter, see curatedList.ts) is
 * "AAPLx" — a real naming mismatch between sources. Matching by the
 * verified mint address sidesteps that entirely.
 */
export type ReserveExposure = {
  ticker: string;
  xstockSymbol: string;
  totalDepositedUsd: number;
};

export function computeAggregateExposure(market: KaminoMarket): {
  total: number;
  byStock: ReserveExposure[];
} {
  const reserves = market.getReserves();
  const byStock: ReserveExposure[] = [];

  for (const stock of CURATED_STOCKS) {
    const reserve = reserves.find(
      (r) => r.getLiquidityMint().toString() === stock.mint
    );
    if (!reserve) continue;

    byStock.push({
      ticker: stock.ticker,
      xstockSymbol: stock.xstockSymbol,
      totalDepositedUsd: reserve.getDepositTvl().toNumber(),
    });
  }

  const total = byStock.reduce((sum, r) => sum + r.totalDepositedUsd, 0);
  return { total, byStock };
}
