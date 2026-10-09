import { getCurrentLedgerInstant, type KaminoObligation, type Position } from "@kamino-finance/klend-sdk";
import { address } from "@solana/kit";
import { createKaminoRpc, loadXStocksMarket } from "./client";
import { CURATED_STOCKS } from "../stocks/curatedList";

/**
 * A wallet's loans on Kamino's xStocks market, and how close each one is to
 * being liquidated.
 *
 * Checked against real borrowers on 2026-10-08: of 7,014 positions in the
 * market, 6,964 are plain loans and about 50 are leveraged ("multiply")
 * positions. Both are read here, via `getAllUserObligations`, so no loan is
 * missed.
 *
 * Kamino decides liquidations with its own price feed (Scope), not with the
 * real stock price. Every number here comes from Kamino's own refreshed
 * stats, so it matches what would actually trigger a liquidation.
 */

/** Below this much room, a loan gets the "safe again" suggestion amounts. */
export const SAFE_DROP = 0.25;

export type LoanLine = { symbol: string; mint: string; amountTokens: number; valueUsd: number; isStock: boolean };

export type LoanRisk = {
  obligation: string;
  /** "standard" is a plain loan; "multiply" and "leverage" are looped positions. */
  kind: "standard" | "multiply" | "leverage" | "other";
  depositedUsd: number;
  stockDepositedUsd: number;
  borrowedUsd: number;
  loanToValue: number;
  liquidationLtv: number;
  /**
   * How far the stock collateral can fall, all together, before the loan
   * can be liquidated (0.084 = 8.4%). 0 means it can be liquidated now.
   * Null when a stock drop can't liquidate it (see `note`).
   */
  dropToLiquidation: number | null;
  /**
   * Why there's no drop figure: "no-debt", "no-stock-risk" (even stocks at
   * zero wouldn't liquidate it) or "stock-debt" (it borrows stock tokens, so
   * a price rise is the risk, which GapGuard doesn't model yet).
   */
  note: "no-debt" | "no-stock-risk" | "stock-debt" | null;
  /** Roughly how much to repay to get back to a 25% cushion. */
  repayToSafeUsd: number;
  /** Or roughly how much more stock collateral to add for the same. */
  addToSafeUsd: number;
  deposits: LoanLine[];
  borrows: LoanLine[];
};

const STOCK_MINTS = new Set(CURATED_STOCKS.map((s) => s.mint));

const KIND_BY_TAG: Record<number, LoanRisk["kind"]> = { 0: "standard", 1: "multiply", 3: "leverage" };

/**
 * The cushion math. Kamino liquidates when the borrow (adjusted by each
 * asset's borrow factor) reaches the liquidation limit (each deposit times
 * its liquidation threshold). If only the stock collateral falls by `d`,
 * its share of the limit falls by `d` too, so:
 *
 *   borrow = (limit - stockLimit) + stockLimit * (1 - d)
 *
 * The stock share of the limit is estimated by value share, which is exact
 * when every deposit has the same threshold (the usual case here).
 */
export function cushionMath(input: {
  borrowAdjusted: number;
  liquidationLimit: number;
  depositedUsd: number;
  stockDepositedUsd: number;
}): { dropToLiquidation: number | null; repayToSafeUsd: number; addToSafeUsd: number } {
  const { borrowAdjusted: b, liquidationLimit: limit, depositedUsd, stockDepositedUsd } = input;
  if (b <= 0.01 || stockDepositedUsd <= 0 || depositedUsd <= 0 || limit <= 0) {
    return { dropToLiquidation: null, repayToSafeUsd: 0, addToSafeUsd: 0 };
  }

  const stockLimit = limit * (stockDepositedUsd / depositedUsd);
  const otherLimit = limit - stockLimit;
  const drop = 1 - (b - otherLimit) / stockLimit;
  // At or past 100%, even stocks going to zero wouldn't liquidate it.
  if (drop >= 1) return { dropToLiquidation: null, repayToSafeUsd: 0, addToSafeUsd: 0 };
  const dropToLiquidation = Math.max(0, drop);

  const safeBorrow = otherLimit + stockLimit * (1 - SAFE_DROP);
  const repayToSafeUsd = Math.max(0, b - safeBorrow);

  const threshold = stockLimit / stockDepositedUsd;
  const addToSafeUsd = Math.max(0, ((b - otherLimit) / (1 - SAFE_DROP) - stockLimit) / threshold);

  return { dropToLiquidation, repayToSafeUsd, addToSafeUsd };
}

function toRisk(
  obligation: KaminoObligation,
  symbolOf: (reserve: string) => string
): LoanRisk {
  const line = (p: Position): LoanLine => {
    const symbol = symbolOf(String(p.reserveAddress));
    const mint = String(p.mintAddress);
    return {
      symbol,
      mint,
      amountTokens: p.amount.div(p.mintFactor).toNumber(),
      valueUsd: p.marketValueRefreshed.toNumber(),
      isStock: STOCK_MINTS.has(mint) || /^[A-Z]{1,6}x$/.test(symbol),
    };
  };

  const stats = obligation.refreshedStats;
  const deposits = obligation.getDeposits().map(line);
  const borrows = obligation.getBorrows().map(line);
  const depositedUsd = deposits.reduce((s, d) => s + d.valueUsd, 0);
  const stockDepositedUsd = deposits.filter((d) => d.isStock).reduce((s, d) => s + d.valueUsd, 0);

  const math = cushionMath({
    borrowAdjusted: stats.userTotalBorrowBorrowFactorAdjusted.toNumber(),
    liquidationLimit: stats.borrowLiquidationLimit.toNumber(),
    depositedUsd,
    stockDepositedUsd,
  });
  const borrowedUsd = stats.userTotalBorrow.toNumber();
  const stockDebt = borrows.some((b) => b.isStock && b.valueUsd >= 0.01);
  const note: LoanRisk["note"] =
    borrowedUsd < 0.01 ? "no-debt" : stockDebt ? "stock-debt" : math.dropToLiquidation === null ? "no-stock-risk" : null;

  return {
    obligation: String(obligation.obligationAddress),
    kind: KIND_BY_TAG[Number(obligation.state.tag)] ?? "other",
    depositedUsd,
    stockDepositedUsd,
    borrowedUsd,
    loanToValue: stats.loanToValue.toNumber(),
    liquidationLtv: stats.liquidationLtv.toNumber(),
    ...(stockDebt ? { dropToLiquidation: null, repayToSafeUsd: 0, addToSafeUsd: 0 } : math),
    note,
    deposits,
    borrows,
  };
}

/**
 * Free public Solana connections time out now and then. A second free
 * provider as backup means one bad minute doesn't hide a loan or skip an
 * alert. Throws only if every connection fails.
 */
const BACKUP_RPC = "https://solana-rpc.publicnode.com";

/** Every loan this wallet has on the xStocks market. Empty if none. */
export async function fetchLoanRisks(rpcUrl: string, walletAddress: string): Promise<LoanRisk[]> {
  const urls = [...new Set([rpcUrl, BACKUP_RPC])];
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await readLoanRisks(url, walletAddress);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function readLoanRisks(rpcUrl: string, walletAddress: string): Promise<LoanRisk[]> {
  const market = await loadXStocksMarket(rpcUrl);
  const now = await getCurrentLedgerInstant(createKaminoRpc(rpcUrl));
  const obligations = await market.getAllUserObligations(address(walletAddress), now);

  const symbolOf = (reserve: string) => market.getReserveByAddress(address(reserve))?.symbol ?? "token";

  return obligations
    .map((o) => toRisk(o, symbolOf))
    .filter((r) => r.depositedUsd >= 0.01 || r.borrowedUsd >= 0.01)
    .sort((a, b) => (a.dropToLiquidation ?? 2) - (b.dropToLiquidation ?? 2));
}
