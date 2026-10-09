import { getCurrentLedgerInstant } from "@kamino-finance/klend-sdk";
import { address } from "@solana/kit";
import { createKaminoRpc, loadXStocksMarket } from "./client";
import { BACKUP_RPC, toRisk } from "./portfolio";
import { getCached, setCached } from "../alerts/store";

/**
 * The Monday shock map: for each size of drop in tokenized stocks, how many
 * real borrowers on Kamino's xStocks market would be liquidated, and how
 * much they've borrowed. Built from one read of every loan in the market,
 * using the same per-loan math as the risk check and the alerts.
 *
 * A full read takes about 25 seconds on the free public Solana connection,
 * so the result is cached for 15 minutes and refreshed in the background.
 */

export const SHOCK_DROPS = [0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3] as const;

export type ShockRow = { drop: number; borrowers: number; borrowedUsd: number };

export type Census = {
  at: string;
  /** Every position in the market, including deposits with no loan. */
  positions: number;
  /** Positions with real debt (over $1). */
  borrowers: number;
  borrowedUsd: number;
  /** Loans a drop in stocks can't liquidate (mostly non-stock collateral, or stock debt). */
  notStockExposed: number;
  rows: ShockRow[];
};

const FRESH_MS = 15 * 60 * 1000;
const CACHE_NAME = "census";

async function scan(rpcUrl: string): Promise<Census> {
  const market = await loadXStocksMarket(rpcUrl);
  const now = await getCurrentLedgerInstant(createKaminoRpc(rpcUrl));
  const obligations = await market.getAllObligationsForMarket(now);
  const symbolOf = (reserve: string) => market.getReserveByAddress(address(reserve))?.symbol ?? "token";

  const loans = obligations.map((o) => toRisk(o, symbolOf)).filter((l) => l.borrowedUsd > 1);
  const exposed = loans.filter((l) => l.dropToLiquidation !== null);

  return {
    at: new Date().toISOString(),
    positions: obligations.length,
    borrowers: loans.length,
    borrowedUsd: loans.reduce((s, l) => s + l.borrowedUsd, 0),
    notStockExposed: loans.length - exposed.length,
    rows: SHOCK_DROPS.map((drop) => {
      const hit = exposed.filter((l) => (l.dropToLiquidation as number) <= drop);
      return { drop, borrowers: hit.length, borrowedUsd: hit.reduce((s, l) => s + l.borrowedUsd, 0) };
    }),
  };
}

export async function computeCensus(rpcUrl: string): Promise<Census> {
  let lastError: unknown;
  for (const url of [...new Set([rpcUrl, BACKUP_RPC])]) {
    try {
      const census = await scan(url);
      memory = census;
      await setCached(CACHE_NAME, census).catch(() => {});
      return census;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

let memory: Census | null = null;
let refreshing: Promise<Census> | null = null;

function isFresh(c: Census | null): boolean {
  return !!c && Date.now() - new Date(c.at).getTime() < FRESH_MS;
}

/**
 * The latest census. Returns a cached copy straight away when there is one
 * (and says whether it needs a refresh); only waits for a full read when
 * nothing has ever been cached.
 */
export async function getCensus(rpcUrl: string): Promise<{ census: Census; stale: boolean }> {
  if (!memory) {
    const cached = await getCached<Census>(CACHE_NAME).catch(() => null);
    if (cached) memory = cached.value;
  }
  if (memory) return { census: memory, stale: !isFresh(memory) };
  return { census: await refreshCensus(rpcUrl), stale: false };
}

/** Starts one refresh at a time, even if several requests ask at once. */
export function refreshCensus(rpcUrl: string): Promise<Census> {
  if (!refreshing) {
    refreshing = computeCensus(rpcUrl).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
