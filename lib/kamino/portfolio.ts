import { VanillaObligation, type Position } from "@kamino-finance/klend-sdk";
import { address } from "@solana/kit";
import { KAMINO_LEND_PROGRAM_ID, loadXStocksMarket } from "./client";

/**
 * A wallet's Kamino lending position on the xStocks market, if it has one.
 * Most connected wallets will simply not have a Kamino obligation at all —
 * that's the normal case, not an error, and this returns `null` for it.
 *
 * ⚠️ Less-verified than the rest of the Kamino integration: this assumes
 * Kamino's xStocks market uses a plain `VanillaObligation` (one deposit
 * reserve, one debt reserve, no leverage/multiply), which fits how the
 * market is described publicly ("borrow stablecoins against xStocks
 * collateral") but hasn't been confirmed against a live wallet that
 * actually holds a position there. If this returns unexpected data for a
 * real Kamino borrower, check whether their obligation is a Multiply or
 * Leverage type instead (see lib/kamino's ObligationType.d.ts).
 */
export type ObligationSummary = {
  /** Current loan-to-value, as a fraction (0.4 = 40%). */
  loanToValue: number;
  /** The LTV at which this obligation gets liquidated. */
  liquidationLtv: number;
  deposits: { mint: string; amountTokens: number; valueUsd: number }[];
  borrows: { mint: string; amountTokens: number; valueUsd: number }[];
};

export async function fetchObligationSummary(
  rpcUrl: string,
  walletAddress: string
): Promise<ObligationSummary | null> {
  const market = await loadXStocksMarket(rpcUrl);
  const obligationType = new VanillaObligation(KAMINO_LEND_PROGRAM_ID);
  const obligation = await market.getObligationByWallet(
    address(walletAddress),
    obligationType
  );
  if (!obligation) return null;

  const toRow = (p: Position) => ({
    mint: String(p.mintAddress),
    amountTokens: p.amount.div(p.mintFactor).toNumber(),
    valueUsd: p.marketValueRefreshed.toNumber(),
  });

  return {
    loanToValue: obligation.refreshedStats.loanToValue.toNumber(),
    liquidationLtv: obligation.refreshedStats.liquidationLtv.toNumber(),
    deposits: obligation.getDeposits().map(toRow),
    borrows: obligation.getBorrows().map(toRow),
  };
}
